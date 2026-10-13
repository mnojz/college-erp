import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { registrationOpen, examEligibility } from "@/app/lib/exams";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

/** Bulk form submission: the complete set of ExamSubject ids the student
 *  wants to appear for — replaces their registrations for the session. */
const SubmitSchema = z.object({
  examSubjectIds: z.array(z.string().trim().min(1)).min(1),
});

/** Session fields shared by GET and POST. */
const sessionSelect = {
  id: true,
  status: true,
  semester: true,
  programId: true,
  registrationDeadline: true,
  resultsPublishedAt: true,
  subjects: {
    select: {
      id: true,
      subjectId: true,
      part: true,
      maxMarks: true,
      subject: { select: { code: true, name: true } },
    },
  },
} as const;

/** One cell of the registration table: an offered part + this student's state. */
type RowCell = {
  id: string;
  maxMarks: number;
  eligible: boolean;
  registered: boolean;
  passed: boolean;
};

/** One subject row of the registration table (theory + practical columns). */
type TableRow = {
  subjectId: string;
  code: string;
  name: string;
  th: RowCell | null;
  pr: RowCell | null;
};

/**
 * GET /api/student/exams/[id] — full detail for the student exam page: exam
 * info, the read-only routine, and the TH/PR registration-table rows with
 * this student's existing selections pre-checked.
 *
 * Visible for the student's own program at their semester or below (regular
 * and backlog), while announced or after results are published (read-only).
 */
export async function GET(_request: Request, ctx: RouteContext) {
  const auth = await requireRole("STUDENT");
  if (!auth) return NextResponse.json({ error: "Student access required" }, { status: 403 });

  const { id } = await ctx.params;

  const student = await prisma.student.findUnique({
    where: { userId: auth.userId },
    select: { id: true, programId: true, currentSemester: true },
  });
  if (!student || !student.programId) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const sessionRecord = await prisma.examSession.findUnique({
    where: { id },
    select: {
      ...sessionSelect,
      title: true,
      type: true,
      routinePublishedAt: true,
      program: { select: { name: true, code: true } },
      routine: {
        orderBy: { order: "asc" },
        select: { date: true, subject: { select: { code: true, name: true } } },
      },
    },
  });

  // Same visibility rules as the list endpoint: own program, semester at or
  // below the student's current one (regular + backlog, never a future exam),
  // and only announced (or already-published) sessions.
  const semester = student.currentSemester ?? sessionRecord?.semester ?? 1;
  if (
    !sessionRecord ||
    sessionRecord.programId !== student.programId ||
    sessionRecord.semester > semester ||
    (sessionRecord.status !== "ANNOUNCED" && sessionRecord.status !== "RESULTS_PUBLISHED")
  ) {
    return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
  }

  const { eligible, isBacklog } = await examEligibility(student.id, semester, sessionRecord);
  const eligibleIds = new Set(eligible.map((e) => e.examSubjectId));

  const registrations = await prisma.examRegistration.findMany({
    where: { studentId: student.id, examSubject: { sessionId: sessionRecord.id } },
    select: { examSubjectId: true },
  });
  const registeredIds = new Set(registrations.map((r) => r.examSubjectId));

  // One row per subject with a TH and a PR cell (null = part not offered).
  const rows = new Map<string, TableRow>();
  for (const s of sessionRecord.subjects) {
    let row = rows.get(s.subjectId);
    if (!row) {
      row = { subjectId: s.subjectId, code: s.subject.code, name: s.subject.name, th: null, pr: null };
      rows.set(s.subjectId, row);
    }
    const cell: RowCell = {
      id: s.id,
      maxMarks: Number(s.maxMarks),
      eligible: eligibleIds.has(s.id),
      registered: registeredIds.has(s.id),
      // A backlog part the session offers but eligibility excluded was passed.
      passed: isBacklog && !eligibleIds.has(s.id),
    };
    if (s.part === "THEORY") row.th = cell;
    else row.pr = cell;
  }

  return NextResponse.json({
    exam: {
      id: sessionRecord.id,
      title: sessionRecord.title,
      type: sessionRecord.type,
      semester: sessionRecord.semester,
      program: sessionRecord.program,
      status: sessionRecord.status,
      registrationDeadline: sessionRecord.registrationDeadline,
      routinePublishedAt: sessionRecord.routinePublishedAt,
      resultsPublishedAt: sessionRecord.resultsPublishedAt,
      isBacklog,
    },
    window: {
      open: registrationOpen(sessionRecord.resultsPublishedAt, sessionRecord.registrationDeadline),
    },
    routine: sessionRecord.routine.map((r) => ({ date: r.date, subject: r.subject })),
    rows: [...rows.values()].sort((a, b) => a.code.localeCompare(b.code)),
    hasRegistrations: registeredIds.size > 0,
  });
}

/**
 * POST /api/student/exams/[id] — submit (or resubmit) the exam form. The
 * given set of ExamSubject ids replaces this student's registrations for the
 * session in one transaction; editable any number of times until the
 * registration deadline, then locked.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireRole("STUDENT");
  if (!auth) return NextResponse.json({ error: "Student access required" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = await jsonBody(request, SubmitSchema);
  if (!parsed.ok) return parsed.response;
  const selected = [...new Set(parsed.value.examSubjectIds)];
  const selectedSet = new Set(selected);

  const student = await prisma.student.findUnique({
    where: { userId: auth.userId },
    select: { id: true, programId: true, currentSemester: true },
  });
  if (!student || !student.programId) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const sessionRecord = await prisma.examSession.findUnique({
    where: { id },
    select: sessionSelect,
  });
  const semester = student.currentSemester ?? sessionRecord?.semester ?? 1;
  if (
    !sessionRecord ||
    sessionRecord.status !== "ANNOUNCED" ||
    sessionRecord.programId !== student.programId ||
    sessionRecord.semester > semester
  ) {
    return NextResponse.json({ error: "Exam session not found or not announced" }, { status: 404 });
  }

  // 1) Registration window check (server-enforced).
  if (!registrationOpen(sessionRecord.resultsPublishedAt, sessionRecord.registrationDeadline)) {
    return NextResponse.json({ error: "Form submission deadline has passed" }, { status: 409 });
  }

  // 2) Every selected part must belong to this session.
  const sessionIds = new Set(sessionRecord.subjects.map((s) => s.id));
  if (selected.some((sid) => !sessionIds.has(sid))) {
    return NextResponse.json({ error: "Invalid subject selection" }, { status: 409 });
  }

  // 3) Eligibility — a part the student already holds a registration for stays
  // valid even if eligibility changed since (prevents a lockout).
  const { eligible, isBacklog } = await examEligibility(student.id, semester, sessionRecord);
  const eligibleIds = new Set(eligible.map((e) => e.examSubjectId));
  const existing = await prisma.examRegistration.findMany({
    where: { studentId: student.id, examSubject: { sessionId: sessionRecord.id } },
    select: { id: true, examSubjectId: true },
  });
  const existingIds = new Set(existing.map((r) => r.examSubjectId));
  const blocked = selected.filter((sid) => !eligibleIds.has(sid) && !existingIds.has(sid));
  if (blocked.length > 0) {
    return NextResponse.json(
      {
        error: isBacklog
          ? "Part not eligible for backlog registration"
          : "Part not eligible for registration",
      },
      { status: 409 },
    );
  }

  // 4) Replace the set atomically: drop deselected parts, add new ones.
  const toDelete = existing.filter((r) => !selectedSet.has(r.examSubjectId)).map((r) => r.id);
  const toCreate = selected.filter((sid) => !existingIds.has(sid));
  try {
    await prisma.$transaction([
      prisma.examRegistration.deleteMany({ where: { id: { in: toDelete } } }),
      prisma.examRegistration.createMany({
        data: toCreate.map((examSubjectId) => ({ examSubjectId, studentId: student.id })),
        skipDuplicates: true,
      }),
    ]);
    return NextResponse.json({ success: true, examSubjectIds: selected });
  } catch (error) {
    console.error("POST /api/student/exams/[id] error:", error);
    return NextResponse.json({ error: "Unable to submit exam form" }, { status: 500 });
  }
}
