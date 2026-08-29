import { NextResponse } from "next/server";
import { Prisma, type DayOfWeek } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ClassBody = {
  id?: unknown;
  subjectId?: unknown;
  teacherId?: unknown;
  programId?: unknown;
  semester?: unknown;
  dayOfWeek?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  type?: unknown;
  group?: unknown;
};

const SLOT_TYPES = ["Lecture", "Practical"] as const;
const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

function parseType(value: unknown) {
  return typeof value === "string" && (SLOT_TYPES as readonly string[]).includes(value)
    ? value
    : "Lecture";
}

function parseGroup(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value)
    ? new Date(`1970-01-01T${value}:00.000Z`)
    : null;
}

/**
 * Type-aware overlap rule:
 *  - Same teacher at the same time always conflicts.
 *  - Lecture + Lab (different slot types) may overlap.
 *  - Lecture + Lecture always conflicts.
 *  - Practical + Practical conflicts unless they are different parallel groups.
 */
function isConflict(
  candidate: { teacherId: string; group: string | null; type: string | null },
  teacherId: string,
  type: string,
  group: string | null,
): boolean {
  if (candidate.teacherId === teacherId) return true;
  // Different slot types (Lecture vs Practical/Lab) may overlap.
  const candidateType = candidate.type ?? "Lecture";
  if (candidateType !== type) return false;
  // Same type — reject unless they are different parallel practical groups.
  const differentGroups = !!candidate.group && !!group && candidate.group !== group;
  if (type === "Practical" && differentGroups) return false;
  return true;
}

type ResolvedTeacher = { teacherId: string | null; error?: string };

/**
 * The teacher for a class slot is derived from the subject's teacher
 * assignments (SubjectTeacher) — the scheduler never picks one from the whole
 * faculty list. An explicitly supplied teacherId must belong to the subject;
 * when omitted we auto-resolve (single assignment, otherwise the assigned
 * teacher currently carrying the fewest scheduled slots for this subject).
 */
async function resolveTeacherForSubject(
  subjectId: string,
  requestedTeacherId: string,
): Promise<ResolvedTeacher> {
  const assignments = await prisma.subjectTeacher.findMany({
    where: { subjectId },
    select: { teacherId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (assignments.length === 0) {
    return {
      teacherId: null,
      error: "No teacher is assigned to this subject yet. Assign one on the Faculty page first.",
    };
  }

  if (requestedTeacherId) {
    return assignments.some((a) => a.teacherId === requestedTeacherId)
      ? { teacherId: requestedTeacherId }
      : { teacherId: null, error: "The selected teacher is not assigned to this subject." };
  }

  if (assignments.length === 1) {
    return { teacherId: assignments[0].teacherId };
  }

  // Multiple assigned teachers → fair share: pick the one with the fewest
  // already-scheduled slots for this subject (ties broken by earliest
  // assignment).
  const counts = await prisma.class.groupBy({
    by: ["teacherId"],
    where: { subjectId, teacherId: { in: assignments.map((a) => a.teacherId) } },
    _count: { _all: true },
  });
  const countByTeacher = new Map(counts.map((c) => [c.teacherId, c._count._all]));
  const best = assignments.reduce((acc, a) =>
    (countByTeacher.get(a.teacherId) ?? 0) < (countByTeacher.get(acc.teacherId) ?? 0) ? a : acc,
  );
  return { teacherId: best.teacherId };
}

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      orderBy: [
        { program: { code: "asc" } },
        { semester: "asc" },
        { subject: { code: "asc" } },
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        subjectId: true,
        teacherId: true,
        programId: true,
        semester: true,
        type: true,
        group: true,
        subject: { select: { name: true, code: true } },
        program: { select: { name: true, code: true } },
        teacher: {
          select: {
            employeeNo: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    return NextResponse.json({ classes });
  } catch (error) {
    console.error("GET /api/classes error:", error);
    return NextResponse.json({ error: "Unable to load classes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ClassBody;
  try {
    body = (await request.json()) as ClassBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  let teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const programId = typeof body.programId === "string" ? body.programId : "";
  const semester = typeof body.semester === "number" ? body.semester : Number(body.semester);
  const dayOfWeek = typeof body.dayOfWeek === "string" ? (body.dayOfWeek as DayOfWeek) : null;
  const startTime = parseTime(body.startTime);
  const endTime = parseTime(body.endTime);
  const type = parseType(body.type);
  const group = parseGroup(body.group);

  if (!subjectId || !programId || !Number.isInteger(semester) || !dayOfWeek || !startTime || !endTime) {
    return NextResponse.json(
      { error: "Subject, program, semester, day, start time, and end time are required" },
      { status: 400 },
    );
  }
  if (!days.includes(dayOfWeek) || startTime >= endTime) {
    return NextResponse.json({ error: "Invalid day of week or invalid time range" }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({ where: { id: subjectId, programId, semester } });
  if (!subject) {
    return NextResponse.json({ error: "Subject does not match program and semester" }, { status: 400 });
  }

  // The teacher comes from the subject's assignments — validate an explicit
  // choice or auto-resolve the assigned teacher for this slot.
  const resolved = await resolveTeacherForSubject(subjectId, teacherId);
  if (resolved.error || !resolved.teacherId) {
    return NextResponse.json(
      { error: resolved.error ?? "No teacher is assigned to this subject." },
      { status: 400 },
    );
  }
  teacherId = resolved.teacherId;

  // Conflict detection: the assigned teacher cannot be in two places at
  // once, same-type slots (Lecture+Lecture / Practical+Practical) cannot
  // overlap in this program+semester (except parallel practical groups),
  // while a Lecture and a Lab may run concurrently.
  const candidates = await prisma.class.findMany({
    where: {
      dayOfWeek,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: [{ teacherId }, { programId, semester }],
    },
    select: {
      startTime: true,
      endTime: true,
      type: true,
      teacherId: true,
      group: true,
      subject: { select: { code: true, name: true } },
      teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  const clash = candidates.find((c) => isConflict(c, teacherId, type, group));

  if (clash) {
    const fmt = (d: Date) =>
      `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    const slot = `${fmt(clash.startTime)}–${fmt(clash.endTime)}${clash.group ? ` (${clash.group})` : ""}`;
    if (clash.teacherId === teacherId) {
      const t = clash.teacher.user;
      return NextResponse.json(
        {
          error: `Schedule conflict: ${t.firstName} ${t.lastName} already teaches ${clash.subject.code} — ${clash.subject.name} on ${dayOfWeek.toLowerCase()} at ${slot}.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: `Schedule conflict: this semester already has ${clash.subject.code} — ${clash.subject.name} on ${dayOfWeek.toLowerCase()} at ${slot}.`,
      },
      { status: 409 },
    );
  }

  try {
    const classItem = await prisma.class.create({
      data: { subjectId, teacherId, programId, semester, dayOfWeek, startTime, endTime, type, group },
      select: {
        id: true, dayOfWeek: true, startTime: true, endTime: true, subjectId: true, teacherId: true, programId: true, semester: true, type: true, group: true,
        subject: { select: { name: true, code: true } },
        program: { select: { name: true, code: true } },
        teacher: { select: { employeeNo: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
    return NextResponse.json({ class: classItem }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This exact class schedule slot already exists" }, { status: 409 });
    }
    console.error("POST /api/classes error:", error);
    return NextResponse.json({ error: "Unable to schedule class" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ClassBody;
  try {
    body = (await request.json()) as ClassBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  let teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const programId = typeof body.programId === "string" ? body.programId : "";
  const semester = typeof body.semester === "number" ? body.semester : Number(body.semester);
  const dayOfWeek = typeof body.dayOfWeek === "string" ? (body.dayOfWeek as DayOfWeek) : null;
  const startTime = parseTime(body.startTime);
  const endTime = parseTime(body.endTime);
  const type = parseType(body.type);
  const group = parseGroup(body.group);

  if (!id || !subjectId || !programId || !Number.isInteger(semester) || !dayOfWeek || !startTime || !endTime) {
    return NextResponse.json(
      { error: "Class ID, subject, program, semester, day, and times are required" },
      { status: 400 },
    );
  }

  if (!days.includes(dayOfWeek) || startTime >= endTime) {
    return NextResponse.json({ error: "Invalid day of week or invalid time range" }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({ where: { id: subjectId, programId, semester } });
  if (!subject) {
    return NextResponse.json({ error: "Subject does not match chosen program and semester" }, { status: 400 });
  }

  // Keep the teacher derived from the subject's assignments (see POST).
  const resolved = await resolveTeacherForSubject(subjectId, teacherId);
  if (resolved.error || !resolved.teacherId) {
    return NextResponse.json(
      { error: resolved.error ?? "No teacher is assigned to this subject." },
      { status: 400 },
    );
  }
  teacherId = resolved.teacherId;

  // Conflict detection (ignores the slot being edited). Same-type overlaps are
  // rejected; Lecture + Lab may overlap; parallel practical groups may overlap.
  const candidates = await prisma.class.findMany({
    where: {
      id: { not: id },
      dayOfWeek,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: [{ teacherId }, { programId, semester }],
    },
    select: {
      startTime: true,
      endTime: true,
      type: true,
      teacherId: true,
      group: true,
      subject: { select: { code: true, name: true } },
      teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  const clash = candidates.find((c) => isConflict(c, teacherId, type, group));

  if (clash) {
    const fmt = (d: Date) =>
      `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    const slot = `${fmt(clash.startTime)}–${fmt(clash.endTime)}${clash.group ? ` (${clash.group})` : ""}`;
    if (clash.teacherId === teacherId) {
      const t = clash.teacher.user;
      return NextResponse.json(
        {
          error: `Schedule conflict: ${t.firstName} ${t.lastName} already teaches ${clash.subject.code} — ${clash.subject.name} on ${dayOfWeek.toLowerCase()} at ${slot}.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: `Schedule conflict: this semester already has ${clash.subject.code} — ${clash.subject.name} on ${dayOfWeek.toLowerCase()} at ${slot}.`,
      },
      { status: 409 },
    );
  }

  try {
    const updatedClass = await prisma.class.update({
      where: { id },
      data: { subjectId, teacherId, programId, semester, dayOfWeek, startTime, endTime, type, group },
      select: {
        id: true, dayOfWeek: true, startTime: true, endTime: true, subjectId: true, teacherId: true, programId: true, semester: true, type: true, group: true,
        subject: { select: { name: true, code: true } },
        program: { select: { name: true, code: true } },
        teacher: { select: { employeeNo: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
    return NextResponse.json({ class: updatedClass }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This exact class schedule slot already exists" }, { status: 409 });
    }
    console.error("PUT /api/classes error:", error);
    return NextResponse.json({ error: "Unable to update class schedule" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = (await request.json()) as { id?: string };
      id = body?.id ?? null;
    } catch {
      // url param
    }
  }

  if (!id) return NextResponse.json({ error: "Class ID is required" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.deleteMany({ where: { session: { classId: id } } });
      await tx.attendanceSession.deleteMany({ where: { classId: id } });
      await tx.class.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "Class slot deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/classes error:", error);
    return NextResponse.json({ error: "Unable to delete class slot" }, { status: 500 });
  }
}
