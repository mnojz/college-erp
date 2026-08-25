import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        enrollmentNumber: true,
        registrationId: true,
        rollNumber: true,
        profileImageUrl: true,
        admissionDate: true,
        programEnrollmentStatus: true,
        programId: true,
        currentSemester: true,
        program: {
          select: {
            id: true,
            name: true,
            code: true,
            durationYears: true,
            departmentName: true,
          },
        },
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });

    return student
      ? NextResponse.json({ student })
      : NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  } catch (error) {
    console.error("GET /api/student/profile error:", error);
    return NextResponse.json({ error: "Unable to load student profile" }, { status: 500 });
  }
}
