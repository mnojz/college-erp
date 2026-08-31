import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      employeeNo: true,
      profileImageUrl: true,
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, status: true },
      },
      classes: {
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          semester: true,
          subjectId: true,
          programId: true,
          subject: { select: { id: true, name: true, code: true } },
          program: {
            select: {
              id: true,
              name: true,
              code: true,
              departmentName: true,
              durationYears: true,
              students: {
                where: { status: "ACTIVE" },
                select: { id: true },
              },
            },
          },
          _count: { select: { sessions: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
    },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
  }

  const subjectIds = teacher.classes.map((c) => c.subject.id);
  const totalAssessments = await prisma.assessment.count({
    where: { subjectId: { in: subjectIds } },
  });

  return NextResponse.json({
    teacher,
    stats: {
      totalClasses: teacher.classes.length,
      totalAssessments,
    },
  });
}
