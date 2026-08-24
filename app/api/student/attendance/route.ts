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
      id: true,
      admissionNo: true,
      rollNumber: true,
      user: { select: { firstName: true, lastName: true } },
      attendance: {
        orderBy: { session: { heldAt: "desc" } },
        select: {
          status: true,
          session: {
            select: {
              heldAt: true,
              offering: { select: { course: { select: { code: true, name: true } }, section: true } },
            },
          },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  return NextResponse.json({ student });
}
