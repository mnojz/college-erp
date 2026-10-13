import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { registrationOpen, examEligibility } from "@/app/lib/exams";

/**
 * GET /api/student/exams — the announced exam session this student may
 * register for right now, with the parts they are eligible to appear for.
 *
 * Picks the announced session at the student's current semester (regular);
 * when none is announced there, falls back to the most recent announced
 * session below their semester (backlog). Returns 404 when nothing is
 * announced for them, which the UI renders as an empty state.
 */
export async function GET() {
  const session = await requireRole("STUDENT");
  if (!session) return NextResponse.json({ error: "Student access required" }, { status: 403 });

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      programId: true,
      currentSemester: true,
      program: { select: { name: true, code: true } },
    },
  });
  if (!student || !student.programId) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const semester = student.currentSemester ?? 1;

  // Regular: an announced session at the student's current semester.
  let sessionRecord = await prisma.examSession.findFirst({
    where: { programId: student.programId, semester, status: "ANNOUNCED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      semester: true,
      programId: true,
      registrationDeadline: true,
      routinePublishedAt: true,
      resultsPublishedAt: true,
      program: { select: { name: true, code: true } },
      subjects: {
        select: {
          id: true,
          subjectId: true,
          part: true,
          maxMarks: true,
          subject: { select: { code: true, name: true } },
        },
      },
    },
  });

  // Backlog fallback: the most recent announced session below their semester.
  if (!sessionRecord) {
    sessionRecord = await prisma.examSession.findFirst({
      where: {
        programId: student.programId,
        semester: { lt: semester },
        status: "ANNOUNCED",
      },
      orderBy: { semester: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        semester: true,
        programId: true,
        registrationDeadline: true,
        routinePublishedAt: true,
        resultsPublishedAt: true,
        program: { select: { name: true, code: true } },
        subjects: {
          select: {
            id: true,
            subjectId: true,
            part: true,
            maxMarks: true,
            subject: { select: { code: true, name: true } },
          },
        },
      },
    });
  }

  if (!sessionRecord) {
    return NextResponse.json({ error: "No announced exam session" }, { status: 404 });
  }

  const { eligible, isBacklog } = await examEligibility(student.id, semester, sessionRecord);

  // Stable order: theory first, then practical, then by subject code.
  const partRank: Record<string, number> = { THEORY: 0, PRACTICAL: 1 };
  const subjects = eligible
    .map((e) => ({
      id: e.examSubjectId,
      part: e.part,
      code: e.code,
      name: e.name,
      maxMarks: e.maxMarks,
    }))
    .sort(
      (a, b) =>
        (partRank[a.part] ?? 9) - (partRank[b.part] ?? 9) || a.code.localeCompare(b.code),
    );

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
    subjects,
  });
}
