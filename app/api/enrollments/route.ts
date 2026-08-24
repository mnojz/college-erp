import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type EnrollmentBody = {
  studentId?: unknown;
  offeringId?: unknown;
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: EnrollmentBody;
  try {
    body = (await request.json()) as EnrollmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const studentId = typeof body.studentId === "string" ? body.studentId : "";
  const offeringId = typeof body.offeringId === "string" ? body.offeringId : "";
  if (!studentId || !offeringId) {
    return NextResponse.json(
      { error: "Student and course offering are required" },
      { status: 400 },
    );
  }

  try {
    const enrollment = await prisma.enrollment.create({
      data: { studentId, offeringId },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        offering: {
          select: {
            id: true,
            section: true,
            course: { select: { code: true, name: true } },
            term: { select: { name: true, number: true } },
          },
        },
      },
    });
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Student is already enrolled" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Student or course offering does not exist" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create enrollment" }, { status: 500 });
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "ENROLLED" },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      student: {
        select: {
          id: true,
          admissionNo: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      offering: {
        select: {
          id: true,
          section: true,
          course: { select: { code: true, name: true } },
          term: { select: { name: true, number: true } },
        },
      },
    },
  });
  return NextResponse.json({ enrollments });
}
