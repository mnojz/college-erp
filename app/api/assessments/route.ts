import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { notifyUsers, studentUserIdsForSemester } from "@/app/lib/notify";

type AssessmentBody = { subjectId?: unknown; programId?: unknown; semester?: unknown; name?: unknown; maxMarks?: unknown; assessmentDate?: unknown };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const where = session.role === "TEACHER" ? { subject: { classes: { some: { teacher: { userId: session.userId } } } } } : undefined;
  const assessments = await prisma.assessment.findMany({
    where,
    orderBy: { assessmentDate: "desc" },
    select: {
      id: true,
      name: true,
      maxMarks: true,
      assessmentDate: true,
      subjectId: true,
      programId: true,
      semester: true,
      subject: { select: { code: true, name: true } },
      program: { select: { code: true, name: true } },
    },
  });
  return NextResponse.json({ assessments });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "TEACHER"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: AssessmentBody;
  try {
    body = (await request.json()) as AssessmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  const programId = typeof body.programId === "string" ? body.programId : "";
  const semester = typeof body.semester === "number" ? body.semester : Number(body.semester);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const maxMarks = typeof body.maxMarks === "number" ? body.maxMarks : 0;
  const assessmentDate = typeof body.assessmentDate === "string" ? new Date(body.assessmentDate) : null;

  if (!subjectId || !programId || !Number.isInteger(semester) || semester < 1 || !name || maxMarks <= 0 || (assessmentDate && Number.isNaN(assessmentDate.getTime()))) {
    return NextResponse.json({ error: "Subject, program, semester, name, positive marks, and valid date are required" }, { status: 400 });
  }

  const subject = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      programId,
      semester,
      ...(session.role === "TEACHER" ? { classes: { some: { teacher: { userId: session.userId } } } } : {}),
    },
    select: { id: true },
  });
  if (!subject) return NextResponse.json({ error: "Subject not found or not assigned to you" }, { status: 403 });

  try {
    const assessment = await prisma.assessment.create({
      data: { subjectId, programId, semester, name, maxMarks, assessmentDate },
      select: { id: true, name: true, maxMarks: true, assessmentDate: true, subjectId: true, programId: true, semester: true },
    });

    // Notify the students of this program + semester.
    try {
      const [subjectInfo, studentIds] = await Promise.all([
        prisma.subject.findUnique({ where: { id: subjectId }, select: { code: true, name: true } }),
        studentUserIdsForSemester(programId, semester),
      ]);
      await notifyUsers(
        studentIds,
        {
          type: "assessment",
          title: `Upcoming assessment in ${subjectInfo?.code ?? "your subject"} — ${subjectInfo?.name ?? ""}`.replace(/ — $/, ""),
          body: `${name} · ${maxMarks} marks`,
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
      return NextResponse.json({ error: "Assessment already exists for this subject and semester" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create assessment" }, { status: 500 });
  }
}
