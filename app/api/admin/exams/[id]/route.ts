import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { computePublishGate, examRoster, marksEntryRole, registrationsBySubject } from "@/app/lib/exams";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const UpdateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  academicYearId: z.string().trim().min(1).nullable().optional(),
  registrationDeadline: z.string().nullable().optional(),
});

/** Full session detail for the admin marking table + publish panel. */
async function loadDetail(id: string) {
  const session = await prisma.examSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      semester: true,
      routinePublishedAt: true,
      resultsPublishedAt: true,
      registrationDeadline: true,
      programId: true,
      program: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, name: true } },
      subjects: {
        orderBy: [{ subject: { code: "asc" } }, { part: "asc" }],
        select: {
          id: true,
          subjectId: true,
          part: true,
          maxMarks: true,
          marksPublishedAt: true,
          subject: { select: { id: true, code: true, name: true, credits: true } },
        },
      },
      routine: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          date: true,
          order: true,
          subjectId: true,
          subject: { select: { code: true, name: true } },
        },
      },
    },
  });
  if (!session) return null;

  const roster = await examRoster(session.programId, session.semester);
  const marks = await prisma.examMark.findMany({
    where: { examSubject: { sessionId: id } },
    select: { examSubjectId: true, studentId: true, marks: true, grade: true, gradePoint: true },
  });
  const registeredBySubject = await registrationsBySubject(id);

  const markByCell = new Map(marks.map((m) => [`${m.examSubjectId}:${m.studentId}`, m]));

  const gateSubjects = session.subjects.map((s) => ({
    id: s.id,
    subjectId: s.subjectId,
    part: s.part,
    maxMarks: Number(s.maxMarks),
    marksPublishedAt: s.marksPublishedAt,
    entryRole: marksEntryRole(session.type, s.part),
    subject: { code: s.subject.code, name: s.subject.name },
    registeredCount: registeredBySubject.get(s.id)?.size ?? 0,
    markCount: marks.filter((m) => m.examSubjectId === s.id).length,
  }));
  const gate = computePublishGate(gateSubjects);

  return { session, roster, markByCell, gate, registeredBySubject };
}

/** GET /api/admin/exams/[id] — full detail incl. roster, marks grid, publish gate. */
export async function GET(_request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const detail = await loadDetail(id);
  if (!detail) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });

  const { session, roster, markByCell, gate, registeredBySubject } = detail;
  return NextResponse.json({
    exam: {
      id: session.id,
      title: session.title,
      type: session.type,
      status: session.status,
      semester: session.semester,
      routinePublishedAt: session.routinePublishedAt,
      resultsPublishedAt: session.resultsPublishedAt,
      registrationDeadline: session.registrationDeadline,
      program: session.program,
      academicYear: session.academicYear,
    },
    subjects: session.subjects.map((s) => ({
      id: s.id,
      subjectId: s.subjectId,
      code: s.subject.code,
      name: s.subject.name,
      part: s.part,
      credits: s.subject.credits,
      maxMarks: Number(s.maxMarks),
      marksPublishedAt: s.marksPublishedAt,
      entryRole: marksEntryRole(session.type, s.part),
      registeredCount: registeredBySubject.get(s.id)?.size ?? 0,
    })),
    roster: roster.map((r) => ({
      id: r.id,
      rollNumber: r.rollNumber,
      enrollmentNumber: r.enrollmentNumber,
      name: `${r.user.firstName} ${r.user.lastName}`.trim(),
    })),
    routine: session.routine.map((r) => ({
      id: r.id,
      date: r.date,
      order: r.order,
      subjectId: r.subjectId,
      subject: r.subject,
    })),
    // Flat { "examSubjectId:studentId": { marks, grade, gradePoint } } map.
    marks: Object.fromEntries(
      Array.from(markByCell.entries()).map(([key, m]) => [
        key,
        { marks: Number(m.marks), grade: m.grade, gradePoint: m.gradePoint === null ? null : Number(m.gradePoint) },
      ]),
    ),
    // { examSubjectId: string[] } — students who registered for each part.
    registeredBySubject: Object.fromEntries(
      Array.from(registeredBySubject.entries()).map(([k, set]) => [k, Array.from(set)]),
    ),
    publishGate: { canPublish: gate.canPublish, blockers: gate.blockers, subjects: gate.subjects },
  });
}

/** PUT /api/admin/exams/[id] — edit title / academic year. */
export async function PUT(request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = await jsonBody(request, UpdateSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await prisma.examSession.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });

  const updated = await prisma.examSession.update({
    where: { id },
    data: {
      title: parsed.value.title,
      ...(parsed.value.academicYearId !== undefined
        ? { academicYearId: parsed.value.academicYearId }
        : {}),
      ...(parsed.value.registrationDeadline !== undefined
        ? { registrationDeadline: parsed.value.registrationDeadline === null ? null : new Date(parsed.value.registrationDeadline) }
        : {}),
    },
    select: { id: true, title: true, registrationDeadline: true },
  });
  return NextResponse.json({ exam: updated });
}

/** DELETE /api/admin/exams/[id] — remove a session (routine + marks cascade). */
export async function DELETE(_request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await prisma.examSession.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });

  await prisma.examSession.delete({ where: { id } });
  return NextResponse.json({ success: true });
}