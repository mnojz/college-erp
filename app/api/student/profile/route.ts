import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 });
  }

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      admissionNo: true,
      rollNumber: true,
      profileImageUrl: true,
      admissionDate: true,
      program: {
        select: {
          id: true,
          name: true,
          code: true,
          durationYears: true,
          department: { select: { name: true, code: true } },
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

  if (!student) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  return NextResponse.json({ student });
}
