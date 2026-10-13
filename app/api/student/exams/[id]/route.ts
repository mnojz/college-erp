import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { registrationOpen, examEligibility } from "@/app/lib/exams";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const RegisterSchema = z.object({
  examSubjectId: z.string().trim().min(1),
  part: z.enum(["THEORY", "PRACTICAL"]),
});

/** POST /api/student/exams/[id] — register for one part of an announced session. */
export async function POST(request: Request, ctx: RouteContext) {
  const session = await requireRole("STUDENT");
  if (!session) return NextResponse.json({ error: "Student access required" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = await jsonBody(request, RegisterSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true, programId: true, currentSemester: true },
  });
  if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const sessionRecord = await prisma.examSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      semester: true,
      programId: true,
      registrationDeadline: true,
      routinePublishedAt: true,
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
    },
  });
  if (!sessionRecord || sessionRecord.status !== "ANNOUNCED") {
    return NextResponse.json({ error: "Exam session not found or not announced" }, { status: 404 });
  }

  // 1) Registration window check (server-enforced).
  const windowOpen = registrationOpen(
    sessionRecord.resultsPublishedAt,
    sessionRecord.registrationDeadline,
  );
  if (!windowOpen) {
    return NextResponse.json(
      { error: "Form submission deadline has passed" },
      { status: 409 },
    );
  }

  // 2) Eligibility check.
  const semester = student.currentSemester ?? sessionRecord.semester;
  const { eligible, isBacklog } = await examEligibility(student.id, semester, sessionRecord);
  const partEligibility = eligible.find(
    (e) => e.examSubjectId === body.examSubjectId && e.part === body.part,
  );
  if (!partEligibility) {
    return NextResponse.json(
      {
        error: isBacklog
          ? "Part not eligible for backlog registration"
          : "Part not eligible for registration",
      },
      { status: 409 },
    );
  }

  // 3) Already-registered guard.
  const existing = await prisma.examRegistration.findUnique({
    where: {
      examSubjectId_studentId: { examSubjectId: body.examSubjectId, studentId: student.id },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Already registered for this part" }, { status: 409 });
  }

  try {
    // The part is already encoded by examSubjectId (each part is its own
    // ExamSubject row), so the registration only stores (examSubjectId, studentId).
    const registration = await prisma.examRegistration.create({
      data: {
        examSubjectId: body.examSubjectId,
        studentId: student.id,
      },
    });
    return NextResponse.json({ success: true, registration });
  } catch (error) {
    console.error("POST /api/student/exams/[id] error:", error);
    return NextResponse.json({ error: "Unable to register for exam" }, { status: 500 });
  }
}
