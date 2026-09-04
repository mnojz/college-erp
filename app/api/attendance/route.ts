import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type AttendanceBody = {
  classId?: unknown;
  sessionDate?: unknown;
  presentStudentIds?: unknown;
};

/** Attendance edits stay open for this long after the FIRST submission. */
const EDIT_WINDOW_MINUTES = 5;

async function getTeacher() {
  const session = await getSession();
  return session?.role === "TEACHER"
    ? prisma.teacher.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      })
    : null;
}

/** `YYYY-MM-DD` → UTC midnight Date (matches `@db.Date` storage). */
function parseSessionDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Loads the session saved for one class on one date (owner-checked) so the
 * client can restore its submitted/locked UI state.
 */
async function findSessionForDate(classId: string, sessionDate: Date, teacherId: string) {
  const owned = await prisma.class.findFirst({
    where: { id: classId, teacherId },
    select: { id: true },
  });
  if (!owned) return { error: "Class not found" as const, status: 404 as const };
  const session = await prisma.attendanceSession.findUnique({
    where: { classId_sessionDate: { classId, sessionDate } },
    select: {
      id: true,
      createdAt: true,
      records: { select: { studentId: true, status: true } },
    },
  });
  return { session };
}

export async function GET(request: Request) {
  const current = await getTeacher();
  if (!current) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  try {
    // Session-lookup mode: `?classId=…&date=YYYY-MM-DD` asks whether
    // attendance was already saved for that class today.
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");
    const dateParam = url.searchParams.get("date");
    if (classId && dateParam) {
      const sessionDate = parseSessionDate(dateParam);
      if (!sessionDate) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      }
      const { error, status, session } = await findSessionForDate(classId, sessionDate, current.id);
      if (error) return NextResponse.json({ error }, { status });
      return NextResponse.json({ session: session ?? null });
    }

    const classes = await prisma.class.findMany({
      where: { teacherId: current.id },
      orderBy: [
        { program: { code: "asc" } },
        { semester: "asc" },
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        semester: true,
        type: true,
        group: true,
        subjectId: true,
        programId: true,
        subject: { select: { name: true, code: true } },
        program: {
          select: {
            // id drives the program filter dropdown keys + grouping on the page.
            id: true,
            name: true,
            code: true,
            students: {
              where: { status: "ACTIVE" },
              select: {
                id: true,
                enrollmentNumber: true,
                rollNumber: true,
                profileImageUrl: true,
                currentSemester: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: "Unable to load classes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const current = await getTeacher();
  if (!current) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  let body: AttendanceBody;
  try {
    body = (await request.json()) as AttendanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const classId = typeof body.classId === "string" ? body.classId : "";
  const sessionDate = typeof body.sessionDate === "string" ? new Date(body.sessionDate) : null;
  const present = Array.isArray(body.presentStudentIds)
    ? body.presentStudentIds.filter((id): id is string => typeof id === "string")
    : null;

  if (!classId || !sessionDate || Number.isNaN(sessionDate.getTime()) || !present) {
    return NextResponse.json({ error: "Class, date, and present students are required" }, { status: 400 });
  }

  const classRecord = await prisma.class.findFirst({
    where: { id: classId, teacherId: current.id },
    select: { id: true, programId: true, semester: true },
  });
  if (!classRecord) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const studentIds = (
    await prisma.student.findMany({
        where: { programId: classRecord.programId, status: "ACTIVE" },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (present.some((id) => !studentIds.includes(id))) {
    return NextResponse.json({ error: "Students must belong to the class program" }, { status: 400 });
  }

  try {
    const session = await prisma.attendanceSession.create({
      data: {
        classId,
        sessionDate,
        records: {
          create: studentIds.map((studentId) => ({
            studentId,
            status: present.includes(studentId) ? "PRESENT" : "ABSENT",
          })),
        },
      },
      select: {
        id: true,
        classId: true,
        sessionDate: true,
        createdAt: true,
        records: { select: { studentId: true, status: true } },
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Someone saved attendance for this class/date already — hand back the
      // existing session so the client can restore its submitted state.
      const existing = await prisma.attendanceSession.findUnique({
        where: { classId_sessionDate: { classId, sessionDate } },
        select: { id: true, createdAt: true, records: { select: { studentId: true, status: true } } },
      });
      return NextResponse.json(
        {
          error: "Attendance has already been submitted for this class date",
          session: existing,
        },
        { status: 409 },
      );
    }
    console.error("POST /api/attendance error:", error);
    return NextResponse.json({ error: "Unable to submit attendance" }, { status: 500 });
  }
}

/**
 * Updates (edits) today's already-submitted session. Allowed only within
 * `EDIT_WINDOW_MINUTES` of the FIRST submission — `createdAt` never moves on
 * edits, so the window always closes relative to the original save.
 */
export async function PUT(request: Request) {
  const current = await getTeacher();
  if (!current) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  let body: AttendanceBody;
  try {
    body = (await request.json()) as AttendanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const classId = typeof body.classId === "string" ? body.classId : "";
  const sessionDate = typeof body.sessionDate === "string" ? parseSessionDate(body.sessionDate) : null;
  const present = Array.isArray(body.presentStudentIds)
    ? body.presentStudentIds.filter((id): id is string => typeof id === "string")
    : null;

  if (!classId || !sessionDate || !present) {
    return NextResponse.json({ error: "Class, date, and present students are required" }, { status: 400 });
  }

  const classRecord = await prisma.class.findFirst({
    where: { id: classId, teacherId: current.id },
    select: { id: true, programId: true, semester: true },
  });
  if (!classRecord) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const session = await prisma.attendanceSession.findUnique({
    where: { classId_sessionDate: { classId, sessionDate } },
    select: { id: true, createdAt: true },
  });
  if (!session) {
    return NextResponse.json({ error: "No attendance session exists to edit for this date" }, { status: 404 });
  }

  // Server-side lock enforcement: edits close 5 minutes after first submission.
  const lockDeadline = session.createdAt.getTime() + EDIT_WINDOW_MINUTES * 60_000;
  if (Date.now() > lockDeadline) {
    return NextResponse.json(
      { error: "The edit window has closed — attendance is locked", locked: true },
      { status: 403 },
    );
  }

  const studentIds = (
    await prisma.student.findMany({
      where: { programId: classRecord.programId, status: "ACTIVE" },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (present.some((id) => !studentIds.includes(id))) {
    return NextResponse.json({ error: "Students must belong to the class program" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.deleteMany({ where: { sessionId: session.id } });
      await tx.attendanceRecord.createMany({
        data: studentIds.map((studentId) => ({
          sessionId: session.id,
          studentId,
          status: present.includes(studentId) ? "PRESENT" : "ABSENT",
        })),
      });
      return tx.attendanceSession.findUnique({
        where: { id: session.id },
        select: { id: true, classId: true, sessionDate: true, createdAt: true },
      });
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error("PUT /api/attendance error:", error);
    return NextResponse.json({ error: "Unable to update attendance" }, { status: 500 });
  }
}
