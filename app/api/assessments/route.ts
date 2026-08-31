import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAuth, requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { notifyUsers, studentUserIdsForSemester } from "@/app/lib/notify";
import { jsonBody } from "@/app/lib/validation";
import { z } from "zod";

/** Decimal(6,2) column — keep client values inside the column's range. */
const MAX_MARKS_CEILING = 9999.99;

const AssessmentBodySchema = z.object({
  subjectId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  maxMarks: z.coerce.number().gt(0).lte(MAX_MARKS_CEILING),
  assessmentDate: z.string().optional(),
});

const AssessmentUpdateSchema = AssessmentBodySchema.extend({
  id: z.string().trim().min(1),
});

const ASSESSMENT_SELECT = {
  id: true,
  name: true,
  maxMarks: true,
  assessmentDate: true,
  subjectId: true,
  programId: true,
  semester: true,
  subject: { select: { code: true, name: true } },
  program: { select: { code: true, name: true } },
  _count: { select: { results: true } },
} as const;

/** Ownership scope: the assessment's subject must have a class taught by this teacher. */
function teacherScope(userId: string) {
  return { subject: { classes: { some: { teacher: { userId } } } } };
}

function parseDate(value: string | undefined): Date | null | "invalid" {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

/** GET /api/assessments — assessments for the caller (teachers see only their own). */
export async function GET() {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = session.role === "TEACHER" ? teacherScope(session.userId) : undefined;

  const assessments = await prisma.assessment.findMany({
    where,
    orderBy: [{ assessmentDate: "desc" }, { name: "asc" }],
    select: ASSESSMENT_SELECT,
  });

  return NextResponse.json({ assessments });
}

/** POST /api/assessments — create an assessment (program + semester derive from the subject). */
export async function POST(request: Request) {
  const session = await requireRole("ADMIN", "TEACHER");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await jsonBody(request, AssessmentBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const assessmentDate = parseDate(body.assessmentDate);
  if (assessmentDate === "invalid") {
    return NextResponse.json({ error: "A valid assessment date is required" }, { status: 400 });
  }

  // The subject is the source of truth for program + semester, so the two can
  // never disagree with the assessment's own class context.
  const subject = await prisma.subject.findFirst({
    where: {
      id: body.subjectId,
      ...(session.role === "TEACHER" ? teacherScope(session.userId).subject : {}),
    },
    select: { id: true, programId: true, semester: true, code: true, name: true },
  });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found or not assigned to you" }, { status: 403 });
  }

  try {
    const assessment = await prisma.assessment.create({
      data: {
        subjectId: subject.id,
        programId: subject.programId,
        semester: subject.semester,
        name: body.name,
        maxMarks: body.maxMarks,
        assessmentDate,
      },
      select: ASSESSMENT_SELECT,
    });

    // Notify the students of this program + semester.
    try {
      const studentIds = await studentUserIdsForSemester(subject.programId, subject.semester);
      await notifyUsers(
        studentIds,
        {
          type: "assessment",
          title: `Upcoming assessment in ${subject.code} — ${subject.name}`,
          body: `${body.name} · ${body.maxMarks} marks`,
          link: "/student/results",
        },
        { excludeUserId: session.userId },
      );
    } catch (notifyError) {
      console.error("assessment notification error:", notifyError);
    }

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An assessment with this name already exists for this subject and semester" },
        { status: 409 },
      );
    }
    console.error("POST /api/assessments error:", error);
    return NextResponse.json({ error: "Unable to create assessment" }, { status: 500 });
  }
}

/** PUT /api/assessments — edit an existing assessment (ownership-checked). */
export async function PUT(request: Request) {
  const session = await requireRole("ADMIN", "TEACHER");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await jsonBody(request, AssessmentUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const assessmentDate = parseDate(body.assessmentDate);
  if (assessmentDate === "invalid") {
    return NextResponse.json({ error: "A valid assessment date is required" }, { status: 400 });
  }

  const existing = await prisma.assessment.findFirst({
    where: { id: body.id, ...(session.role === "TEACHER" ? teacherScope(session.userId) : {}) },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Assessment not found or not assigned to you" }, { status: 404 });
  }

  const subject = await prisma.subject.findFirst({
    where: {
      id: body.subjectId,
      ...(session.role === "TEACHER" ? teacherScope(session.userId).subject : {}),
    },
    select: { id: true, programId: true, semester: true },
  });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found or not assigned to you" }, { status: 403 });
  }

  try {
    const assessment = await prisma.assessment.update({
      where: { id: existing.id },
      data: {
        subjectId: subject.id,
        programId: subject.programId,
        semester: subject.semester,
        name: body.name,
        maxMarks: body.maxMarks,
        assessmentDate,
      },
      select: ASSESSMENT_SELECT,
    });
    return NextResponse.json({ assessment });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An assessment with this name already exists for this subject and semester" },
        { status: 409 },
      );
    }
    console.error("PUT /api/assessments error:", error);
    return NextResponse.json({ error: "Unable to update assessment" }, { status: 500 });
  }
}

/** DELETE /api/assessments?id=… — delete an assessment (recorded results cascade). */
export async function DELETE(request: Request) {
  const session = await requireRole("ADMIN", "TEACHER");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = (await request.json()) as { id?: string };
      id = body?.id;
    } catch {
      /* no body — fall through to validation */
    }
  }
  if (!id) return NextResponse.json({ error: "Assessment ID is required" }, { status: 400 });

  const existing = await prisma.assessment.findFirst({
    where: { id, ...(session.role === "TEACHER" ? teacherScope(session.userId) : {}) },
    select: { id: true, name: true, _count: { select: { results: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Assessment not found or not assigned to you" }, { status: 404 });
  }

  try {
    await prisma.assessment.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true, deletedResults: existing._count.results });
  } catch (error) {
    console.error("DELETE /api/assessments error:", error);
    return NextResponse.json({ error: "Unable to delete assessment" }, { status: 500 });
  }
}
