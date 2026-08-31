import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { notifyEachUser } from "@/app/lib/notify";
import { jsonBody } from "@/app/lib/validation";
import { gradeForMarks } from "@/app/lib/grading";

const ResultsBodySchema = z.object({
  assessmentId: z.string().trim().min(1),
  results: z
    .array(
      z.object({
        studentId: z.string().trim().min(1),
        marks: z.coerce.number().min(0),
      }),
    )
    .min(1, "Enter marks for at least one student"),
});

/** Ownership scope: the assessment's subject must have a class taught by this teacher. */
function teacherScope(userId: string) {
  return { subject: { classes: { some: { teacher: { userId } } } } };
}

/**
 * GET /api/results?assessmentId=… — previously recorded marks for one
 * assessment. Lets the teacher edit marks instead of blindly re-entering them.
 */
export async function GET(request: Request) {
  const session = await requireRole("ADMIN", "TEACHER");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get("assessmentId")?.trim() ?? "";
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      ...(session.role === "TEACHER" ? teacherScope(session.userId) : {}),
    },
    select: { id: true },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const results = await prisma.result.findMany({
    where: { assessmentId },
    orderBy: [{ student: { rollNumber: "asc" } }, { student: { enrollmentNumber: "asc" } }],
    select: {
      id: true,
      studentId: true,
      marks: true,
      grade: true,
      student: {
        select: {
          enrollmentNumber: true,
          rollNumber: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return NextResponse.json({ results });
}

/**
 * POST /api/results — record marks for an assessment. The grade is ALWAYS
 * computed server-side from marks vs full marks (single source of truth:
 * app/lib/grading.ts), so a stale or hand-edited client can never store a
 * grade that disagrees with the marks.
 */
export async function POST(request: Request) {
  const session = await requireRole("ADMIN", "TEACHER");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await jsonBody(request, ResultsBodySchema);
  if (!parsed.ok) return parsed.response;
  const { assessmentId, results: inputs } = parsed.value;

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      ...(session.role === "TEACHER" ? teacherScope(session.userId) : {}),
    },
    select: { id: true, name: true, maxMarks: true, programId: true, subjectId: true },
  });
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

  const maxMarks = Number(assessment.maxMarks);
  if (inputs.some((r) => r.marks > maxMarks)) {
    return NextResponse.json(
      { error: `Marks must be between 0 and ${maxMarks}` },
      { status: 400 },
    );
  }

  const validIds = new Set(
    (
      await prisma.student.findMany({
        where: { programId: assessment.programId, status: "ACTIVE" },
        select: { id: true },
      })
    ).map((student) => student.id),
  );
  if (inputs.some((record) => !validIds.has(record.studentId))) {
    return NextResponse.json({ error: "Results contain an invalid student" }, { status: 400 });
  }

  const records = inputs.map((record) => ({
    studentId: record.studentId,
    marks: record.marks,
    grade: gradeForMarks(record.marks, maxMarks),
  }));

  const results = await prisma.$transaction(
    records.map((record) =>
      prisma.result.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId: record.studentId } },
        create: { assessmentId, ...record },
        update: { marks: record.marks, grade: record.grade },
      }),
    ),
  );

  // Notify each affected student that their marks are published.
  try {
    const [assessmentInfo, studentRows] = await Promise.all([
      prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { name: true, maxMarks: true, subject: { select: { code: true, name: true } } },
      }),
      prisma.student.findMany({
        where: { id: { in: results.map((r) => r.studentId) } },
        select: { id: true, userId: true },
      }),
    ]);
    if (assessmentInfo) {
      const userIdByStudent = new Map(studentRows.map((s) => [s.id, s.userId]));
      const subjectLabel = assessmentInfo.subject
        ? `${assessmentInfo.subject.code} — ${assessmentInfo.subject.name}`
        : "your subject";
      await notifyEachUser(
        results
          .map((r) => {
            const userId = userIdByStudent.get(r.studentId);
            if (!userId) return null;
            return {
              userId,
              type: "result",
              title: `Result published: ${assessmentInfo.name}`,
              body: `${subjectLabel}: ${r.marks}/${Number(assessmentInfo.maxMarks)} (${r.grade ?? "—"})`,
              link: "/student/results",
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null),
      );
    }
  } catch (notifyError) {
    console.error("result notification error:", notifyError);
  }

  return NextResponse.json({ results }, { status: 201 });
}

