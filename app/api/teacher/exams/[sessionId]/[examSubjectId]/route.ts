import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { examRoster } from "@/app/lib/exams";
import { resolveTeacherExamSubject } from "@/app/lib/exam-teacher";
import { gradeForMarks, gradePointForMarks } from "@/app/lib/grading";
import { z } from "zod";

type RouteContext = { params: Promise<{ sessionId: string; examSubjectId: string }> };

const MARKS_CEILING = 9999.99;

const SaveSchema = z.object({
  cells: z.array(
    z.object({
      studentId: z.string().trim().min(1),
      marks: z.coerce.number().min(0).lte(MARKS_CEILING),
    }),
  ),
});

/** GET — roster + existing marks for one teacher-entered exam subject. */
export async function GET(_request: Request, ctx: RouteContext) {
  const session = await requireRole("TEACHER");
  if (!session) return NextResponse.json({ error: "Teacher access required" }, { status: 403 });

  const { sessionId, examSubjectId } = await ctx.params;
  const examSubject = await resolveTeacherExamSubject(sessionId, examSubjectId, session.userId);
  if (!examSubject) {
    return NextResponse.json({ error: "Exam subject not found or not assigned to you" }, { status: 404 });
  }

  const roster = await examRoster(examSubject.session.programId, examSubject.session.semester);
  const marks = await prisma.examMark.findMany({
    where: { examSubjectId },
    select: { studentId: true, marks: true, grade: true, gradePoint: true },
  });
  const markByStudent = new Map(marks.map((m) => [m.studentId, m]));

  return NextResponse.json({
    examSubject: {
      id: examSubject.id,
      sessionId: examSubject.session.id,
      title: examSubject.session.title,
      type: examSubject.session.type,
      semester: examSubject.session.semester,
      maxMarks: Number(examSubject.maxMarks),
      marksPublishedAt: examSubject.marksPublishedAt,
      subject: examSubject.subject,
    },
    roster: roster.map((r) => ({
      id: r.id,
      rollNumber: r.rollNumber,
      enrollmentNumber: r.enrollmentNumber,
      name: `${r.user.firstName} ${r.user.lastName}`.trim(),
    })),
    marks: Object.fromEntries(
      roster.map((r) => {
        const m = markByStudent.get(r.id);
        return [
          r.id,
          m
            ? {
                marks: Number(m.marks),
                grade: m.grade,
                gradePoint: m.gradePoint === null ? null : Number(m.gradePoint),
              }
            : null,
        ];
      }),
    ),
  });
}

/** PUT — teacher saves marks for their subject. Grade/point computed server-side. */
export async function PUT(request: Request, ctx: RouteContext) {
  const session = await requireRole("TEACHER");
  if (!session) return NextResponse.json({ error: "Teacher access required" }, { status: 403 });

  const { sessionId, examSubjectId } = await ctx.params;
  const examSubject = await resolveTeacherExamSubject(sessionId, examSubjectId, session.userId);
  if (!examSubject) {
    return NextResponse.json({ error: "Exam subject not found or not assigned to you" }, { status: 404 });
  }

  const parsed = await jsonBody(request, SaveSchema);
  if (!parsed.ok) return parsed.response;

  const maxMarks = Number(examSubject.maxMarks);
  if (parsed.value.cells.some((c) => c.marks > maxMarks)) {
    return NextResponse.json({ error: `Marks must be between 0 and ${maxMarks}` }, { status: 400 });
  }

  const roster = await examRoster(examSubject.session.programId, examSubject.session.semester);
  const rosterIds = new Set(roster.map((r) => r.id));
  if (parsed.value.cells.some((c) => !rosterIds.has(c.studentId))) {
    return NextResponse.json({ error: "Cell references a student not in this cohort" }, { status: 400 });
  }

  try {
    const results = await prisma.$transaction(
      parsed.value.cells.map((cell) =>
        prisma.examMark.upsert({
          where: {
            examSubjectId_studentId: { examSubjectId, studentId: cell.studentId },
          },
          create: {
            examSubjectId,
            studentId: cell.studentId,
            marks: cell.marks,
            grade: gradeForMarks(cell.marks, maxMarks),
            gradePoint: gradePointForMarks(cell.marks, maxMarks),
            enteredBy: session.userId,
          },
          update: {
            marks: cell.marks,
            grade: gradeForMarks(cell.marks, maxMarks),
            gradePoint: gradePointForMarks(cell.marks, maxMarks),
            enteredBy: session.userId,
          },
        }),
      ),
    );
    return NextResponse.json({ saved: results.length });
  } catch (error) {
    console.error("PUT /api/teacher/exams/... error:", error);
    return NextResponse.json({ error: "Unable to save marks" }, { status: 500 });
  }
}

/** POST — teacher publishes their subject's marks (a publish-gate requirement). */
export async function POST(_request: Request, ctx: RouteContext) {
  const session = await requireRole("TEACHER");
  if (!session) return NextResponse.json({ error: "Teacher access required" }, { status: 403 });

  const { sessionId, examSubjectId } = await ctx.params;
  const examSubject = await resolveTeacherExamSubject(sessionId, examSubjectId, session.userId);
  if (!examSubject) {
    return NextResponse.json({ error: "Exam subject not found or not assigned to you" }, { status: 404 });
  }

  // Require a mark for every rostered student before a teacher can publish.
  const roster = await examRoster(examSubject.session.programId, examSubject.session.semester);
  const markCount = await prisma.examMark.count({ where: { examSubjectId } });
  if (markCount < roster.length) {
    return NextResponse.json(
      { error: `Enter marks for all ${roster.length} students before publishing (${markCount} done)` },
      { status: 409 },
    );
  }

  await prisma.examSubject.update({
    where: { id: examSubjectId },
    data: { marksPublishedAt: new Date(), marksPublishedBy: session.userId },
  });
  return NextResponse.json({ success: true });
}