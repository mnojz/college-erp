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
        rollNumber: true,
        attendanceRecords: {
          orderBy: { session: { sessionDate: "desc" } },
          select: {
            id: true,
            status: true,
            note: true,
            session: {
              select: {
                sessionDate: true,
                class: {
                  select: {
                    dayOfWeek: true,
                    startTime: true,
                    endTime: true,
                    semester: true,
                    subject: { select: { code: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return student
      ? NextResponse.json({ student })
      : NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  } catch (error) {
    console.error("GET /api/student/attendance error:", error);
    return NextResponse.json({ error: "Unable to load student attendance" }, { status: 500 });
  }
}
