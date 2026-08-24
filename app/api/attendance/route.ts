import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type AttendanceBody = {
  offeringId?: unknown;
  heldAt?: unknown;
  presentStudentIds?: unknown;
};

async function getTeacherForSession() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return null;
  }

  return prisma.teacher.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
}

export async function GET() {
  const teacher = await getTeacherForSession();
  if (!teacher) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  const offerings = await prisma.courseOffering.findMany({
    where: { teacherId: teacher.id },
    orderBy: { course: { code: "asc" } },
    select: {
      id: true,
      section: true,
      course: { select: { code: true, name: true } },
      term: { select: { name: true, number: true, academicYear: { select: { name: true } } } },
      enrollments: {
        where: { status: "ENROLLED" },
        orderBy: [{ student: { rollNumber: "asc" } }, { student: { admissionNo: "asc" } }],
        select: {
          student: {
            select: {
              id: true,
              rollNumber: true,
              admissionNo: true,
              profileImageUrl: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ offerings });
}

export async function POST(request: Request) {
  const teacher = await getTeacherForSession();
  if (!teacher) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  let body: AttendanceBody;
  try {
    body = (await request.json()) as AttendanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const offeringId = typeof body.offeringId === "string" ? body.offeringId : "";
  const heldAt = typeof body.heldAt === "string" ? new Date(body.heldAt) : new Date();
  const presentStudentIds = Array.isArray(body.presentStudentIds)
    ? body.presentStudentIds.filter((id): id is string => typeof id === "string")
    : null;

  if (!offeringId || Number.isNaN(heldAt.getTime()) || !presentStudentIds) {
    return NextResponse.json(
      { error: "Offering, valid date, and present student IDs are required" },
      { status: 400 },
    );
  }

  const uniquePresentStudentIds = [...new Set(presentStudentIds)];
  const offering = await prisma.courseOffering.findFirst({
    where: { id: offeringId, teacherId: teacher.id },
    select: {
      id: true,
      enrollments: {
        where: { status: "ENROLLED" },
        select: { studentId: true },
      },
    },
  });

  if (!offering) {
    return NextResponse.json({ error: "Course offering not found" }, { status: 404 });
  }

  const enrolledStudentIds = new Set(offering.enrollments.map((enrollment) => enrollment.studentId));
  if (uniquePresentStudentIds.some((studentId) => !enrolledStudentIds.has(studentId))) {
    return NextResponse.json(
      { error: "Every present student must be enrolled in this offering" },
      { status: 400 },
    );
  }

  try {
    const session = await prisma.$transaction(async (transaction) => {
      const attendanceSession = await transaction.attendanceSession.create({
        data: {
          offeringId: offering.id,
          teacherId: teacher.id,
          heldAt,
          records: {
            create: offering.enrollments.map(({ studentId }) => ({
              studentId,
              status: uniquePresentStudentIds.includes(studentId) ? "PRESENT" : "ABSENT",
            })),
          },
        },
        select: {
          id: true,
          offeringId: true,
          teacherId: true,
          heldAt: true,
          records: { select: { studentId: true, status: true } },
        },
      });

      return attendanceSession;
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Attendance has already been submitted for this class time" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Unable to submit attendance" }, { status: 500 });
  }
}
