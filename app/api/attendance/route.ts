import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type AttendanceBody = {
  classId?: unknown;
  sessionDate?: unknown;
  presentStudentIds?: unknown;
};

async function getTeacher() {
  const session = await getSession();
  return session?.role === "TEACHER"
    ? prisma.teacher.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      })
    : null;
}

export async function GET() {
  const current = await getTeacher();
  if (!current) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  try {
    const classes = await prisma.class.findMany({
      where: { teacherId: current.id },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        semester: true,
        subjectId: true,
        programId: true,
        subject: { select: { name: true, code: true } },
        program: {
          select: {
            name: true,
            code: true,
            students: {
              where: { programEnrollmentStatus: "ENROLLED" },
              select: {
                id: true,
                enrollmentNumber: true,
                rollNumber: true,
                profileImageUrl: true,
                currentSemester: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: "Unable to load classes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const current = await getTeacher();
  if (!current) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  let body: AttendanceBody;
  try {
    body = (await request.json()) as AttendanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const classId = typeof body.classId === "string" ? body.classId : "";
  const sessionDate = typeof body.sessionDate === "string" ? new Date(body.sessionDate) : null;
  const present = Array.isArray(body.presentStudentIds)
    ? body.presentStudentIds.filter((id): id is string => typeof id === "string")
    : null;

  if (!classId || !sessionDate || Number.isNaN(sessionDate.getTime()) || !present) {
    return NextResponse.json({ error: "Class, date, and present students are required" }, { status: 400 });
  }

  const classRecord = await prisma.class.findFirst({
    where: { id: classId, teacherId: current.id },
    select: { id: true, programId: true, semester: true },
  });
  if (!classRecord) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const studentIds = (
    await prisma.student.findMany({
      where: { programId: classRecord.programId, programEnrollmentStatus: "ENROLLED" },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (present.some((id) => !studentIds.includes(id))) {
    return NextResponse.json({ error: "Students must belong to the class program" }, { status: 400 });
  }

  try {
    const session = await prisma.attendanceSession.create({
      data: {
        classId,
        sessionDate,
        records: {
          create: studentIds.map((studentId) => ({
            studentId,
            status: present.includes(studentId) ? "PRESENT" : "ABSENT",
          })),
        },
      },
      select: {
        id: true,
        classId: true,
        sessionDate: true,
        records: { select: { studentId: true, status: true } },
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Attendance has already been submitted for this class date" },
        { status: 400 },
      );
    }
    console.error("POST /api/attendance error:", error);
    return NextResponse.json({ error: "Unable to submit attendance" }, { status: 500 });
  }
}
