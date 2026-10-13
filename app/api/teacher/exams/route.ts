import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { marksEntryRole } from "@/app/lib/exams";

/**
 * GET /api/teacher/exams — exam subjects the signed-in teacher can enter marks
 * for (TEACHER-entered subjects they are assigned to, in non-published sessions),
 * grouped by session. Drives the teacher "Exam Marks" landing list.
 */
export async function GET() {
  const session = await requireRole("TEACHER");
  if (!session) return NextResponse.json({ error: "Teacher access required" }, { status: 403 });

  // Exam subjects whose parent session isn't results-published, where this
  // teacher teaches the subject, and the entry role is TEACHER (practical /
  // mid-term). THEORY parts in an END_SEMESTER session are admin-entered and
  // are therefore excluded.
  const examSubjects = await prisma.examSubject.findMany({
    where: {
      session: { resultsPublishedAt: null },
      subject: { subjectTeachers: { some: { teacher: { userId: session.userId } } } },
    },
    orderBy: [{ session: { createdAt: "desc" } }, { subject: { code: "asc" } }, { part: "asc" }],
    select: {
      id: true,
      part: true,
      maxMarks: true,
      marksPublishedAt: true,
      session: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          semester: true,
          routinePublishedAt: true,
          program: { select: { name: true, code: true } },
        },
      },
      subject: { select: { id: true, code: true, name: true } },
    },
  });

  // Filter to TEACHER-entry subjects and compute per-subject mark progress.
  // Teacher-entered marks only cover REGISTERED students, so counts are scoped
  // to registrations (students who submitted the exam form for that part).
  const filtered = examSubjects.filter(
    (es) => marksEntryRole(es.session.type, es.part) === "TEACHER",
  );

  const counts = await prisma.examMark.groupBy({
    by: ["examSubjectId"],
    where: { examSubjectId: { in: filtered.map((es) => es.id) } },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((c) => [c.examSubjectId, c._count._all]));

  const regCounts = await prisma.examRegistration.groupBy({
    by: ["examSubjectId"],
    where: { examSubjectId: { in: filtered.map((es) => es.id) } },
    _count: { _all: true },
  });
  const regCountById = new Map(regCounts.map((c) => [c.examSubjectId, c._count._all]));

  const items = filtered.map((es) => ({
    examSubjectId: es.id,
    sessionId: es.session.id,
    part: es.part,
    maxMarks: Number(es.maxMarks),
    marksPublishedAt: es.marksPublishedAt,
    entryRole: marksEntryRole(es.session.type, es.part),
    subject: es.subject,
    session: {
      id: es.session.id,
      title: es.session.title,
      type: es.session.type,
      status: es.session.status,
      semester: es.session.semester,
      program: es.session.program,
    },
    markCount: countById.get(es.id) ?? 0,
    registeredCount: regCountById.get(es.id) ?? 0,
  }));

  return NextResponse.json({ items });
}