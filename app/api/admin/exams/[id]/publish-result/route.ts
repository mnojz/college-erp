import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { computePublishGate, examRoster, marksEntryRole, registrationsBySubject } from "@/app/lib/exams";
import { notifyUsers } from "@/app/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/exams/[id]/publish-result — publish the exam results.
 *
 * Gated: every subject (theory AND practical) must have a mark for every
 * rostered student, and every teacher-entered (practical / mid-term) subject
 * must have been teacher-published. On success: session → RESULTS_PUBLISHED,
 * students notified, results become visible on the student results page.
 */
export async function POST(_request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const session = await prisma.examSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      resultsPublishedAt: true,
      programId: true,
      semester: true,
      program: { select: { name: true } },
      subjects: {
        select: {
          id: true,
          subjectId: true,
          part: true,
          maxMarks: true,
          marksPublishedAt: true,
          subject: { select: { code: true, name: true } },
        },
      },
    },
  });
  if (!session) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
  if (session.resultsPublishedAt) {
    return NextResponse.json({ error: "Results are already published" }, { status: 409 });
  }

  const roster = await examRoster(session.programId, session.semester);
  const marks = await prisma.examMark.findMany({
    where: { examSubject: { sessionId: id } },
    select: { examSubjectId: true },
  });
  const markCountBySubject = new Map<string, number>();
  for (const m of marks) {
    markCountBySubject.set(m.examSubjectId, (markCountBySubject.get(m.examSubjectId) ?? 0) + 1);
  }

  const registeredBySubject = await registrationsBySubject(id);

  const gateSubjects = session.subjects.map((s) => ({
    id: s.id,
    subjectId: s.subjectId,
    part: s.part,
    maxMarks: Number(s.maxMarks),
    marksPublishedAt: s.marksPublishedAt,
    entryRole: marksEntryRole(session.type, s.part),
    subject: { code: s.subject.code, name: s.subject.name },
    registeredCount: registeredBySubject.get(s.id)?.size ?? 0,
    markCount: markCountBySubject.get(s.id) ?? 0,
  }));
  const gate = computePublishGate(gateSubjects);

  if (!gate.canPublish) {
    return NextResponse.json(
      { error: "Results cannot be published yet", blockers: gate.blockers },
      { status: 409 },
    );
  }

  const now = new Date();
  await prisma.examSession.update({
    where: { id },
    data: {
      status: "RESULTS_PUBLISHED",
      resultsPublishedAt: now,
      resultsPublishedBy: auth.userId,
    },
  });

  // Notify the cohort that their result is available.
  try {
    const studentRows = await prisma.student.findMany({
      where: { programId: session.programId, currentSemester: session.semester, status: "ACTIVE" },
      select: { userId: true },
    });
    await notifyUsers(
      studentRows.map((s) => s.userId),
      {
        type: "result",
        title: `Result published: ${session.title}`,
        body: `Your result for ${session.program.name} Semester ${session.semester} is now available. Open your Result page to view the marksheet.`,
        link: "/student/results",
      },
      { excludeUserId: auth.userId },
    );
  } catch (notifyError) {
    console.error("exam result notification error:", notifyError);
  }

  return NextResponse.json({ success: true, publishedAt: now });
}