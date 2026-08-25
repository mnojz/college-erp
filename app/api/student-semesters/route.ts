import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type Body = {
  studentId?: unknown;
  semester?: unknown;
};

/** POST /api/student-semesters — advance a student to a new semester number */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const semester =
    typeof body.semester === "number" ? body.semester : Number(body.semester);

  if (!studentId || !Number.isInteger(semester) || semester < 1) {
    return NextResponse.json(
      { error: "Student and a valid semester number are required" },
      { status: 400 },
    );
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { programId: true, program: { select: { durationYears: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const maxSemester = student.program ? student.program.durationYears * 2 : 8;
    if (semester > maxSemester) {
      return NextResponse.json(
        { error: `Semester must be between 1 and ${maxSemester} for this program` },
        { status: 400 },
      );
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { currentSemester: semester },
      select: { id: true, enrollmentNumber: true, currentSemester: true },
    });

    return NextResponse.json({ student: updatedStudent }, { status: 200 });
  } catch (error) {
    console.error("POST /api/student-semesters error:", error);
    return NextResponse.json({ error: "Unable to update student semester" }, { status: 500 });
  }
}
