import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return NextResponse.json({ error: "Student access required" }, { status: 403 });
  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      results: {
        orderBy: { assessment: { assessmentDate: "desc" } },
        select: { marks: true, grade: true, assessment: { select: { name: true, maxMarks: true, assessmentDate: true, offering: { select: { course: { select: { code: true, name: true } }, term: { select: { name: true } } } } } } },
      },
    },
  });
  if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  return NextResponse.json({ results: student.results });
}
