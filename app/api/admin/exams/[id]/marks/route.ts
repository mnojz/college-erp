import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { examRoster, marksEntryRole } from "@/app/lib/exams";
import { gradeForMarks, gradePointForMarks } from "@/app/lib/grading";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

/** Decimal(6,2) column — keep client values inside the column's range. */
const MARKS_CEILING = 9999.99;

const MarksSchema = z.object({
  // One cell per (subject, student). Blank marks are omitted by the client.
  cells: z.array(
    z.object({
      examSubjectId: z.string().trim().min(1),
      studentId: z.string().trim().min(1),
      marks: z.coerce.number().min(0).lte(MARKS_CEILING),
    }),
  ),
});

/**
 * PUT /api/admin/exams/[id]/marks — admin saves the end-semester THEORY marks
 * matrix. Only admin-entered (THEORY in END_SEMESTER) subjects are accepted here;
 * teacher-entered subjects go through the teacher API. Grade + grade point are
 * computed server-side from marks vs the subject's full marks.
 */
export async function PUT(request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = await jsonBody(request, MarksSchema);
  if (!parsed.ok) return parsed.response;

  const session = await prisma.examSession.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      resultsPublishedAt: true,
      programId: true,
      semester: true,
      subjects: {
        select: {
          id: true,
          part: true,
          maxMarks: true,
        },
      },
    },
  });
  if (!session) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
  if (session.resultsPublishedAt) {
    return NextResponse.json({ error: "Results are already published" }, { status: 409 });
  }

  // Map examSubjectId → { maxMarks, entryRole }; reject unknown/foreign cells.
  const subjectById = new Map(
    session.subjects.map((s) => [
      s.id,
      { maxMarks: Number(s.maxMarks), entryRole: marksEntryRole(session.type, s.part) },
    ]),
  );

  // Validate every cell: must reference a subject in this session, be an
  // admin-entered subject, belong to a REGISTERED student, and respect full
  // marks. Students who never submitted the form get no marks row.
  const registeredIds = new Set<string>();
  const registrations = await prisma.examRegistration.findMany({
    where: { examSubject: { sessionId: id } },
    select: { examSubjectId: true, studentId: true },
  });
  for (const r of registrations) registeredIds.add(`${r.examSubjectId}:${r.studentId}`);

  for (const cell of parsed.value.cells) {
    const subject = subjectById.get(cell.examSubjectId);
    if (!subject) {
      return NextResponse.json({ error: "Cell references a subject not in this exam" }, { status: 400 });
    }
    if (subject.entryRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Only theory (admin-entered) subjects can be saved here" },
        { status: 400 },
      );
    }
    if (!registeredIds.has(`${cell.examSubjectId}:${cell.studentId}`)) {
      return NextResponse.json(
        { error: "Marks can only be entered for students who submitted the exam form" },
        { status: 400 },
      );
    }
    if (cell.marks > subject.maxMarks) {
      return NextResponse.json(
        { error: `Marks must be between 0 and ${subject.maxMarks}` },
        { status: 400 },
      );
    }
  }

  try {
    const results = await prisma.$transaction(
      parsed.value.cells.map((cell) => {
        const { maxMarks } = subjectById.get(cell.examSubjectId)!;
        return prisma.examMark.upsert({
          where: {
            examSubjectId_studentId: {
              examSubjectId: cell.examSubjectId,
              studentId: cell.studentId,
            },
          },
          create: {
            examSubjectId: cell.examSubjectId,
            studentId: cell.studentId,
            marks: cell.marks,
            grade: gradeForMarks(cell.marks, maxMarks),
            gradePoint: gradePointForMarks(cell.marks, maxMarks),
            enteredBy: auth.userId,
          },
          update: {
            marks: cell.marks,
            grade: gradeForMarks(cell.marks, maxMarks),
            gradePoint: gradePointForMarks(cell.marks, maxMarks),
            enteredBy: auth.userId,
          },
        });
      }),
    );
    return NextResponse.json({ saved: results.length });
  } catch (error) {
    console.error("PUT /api/admin/exams/[id]/marks error:", error);
    return NextResponse.json({ error: "Unable to save marks" }, { status: 500 });
  }
}