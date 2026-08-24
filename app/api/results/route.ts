import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ResultInput = { studentId?: unknown; marks?: unknown; grade?: unknown };
type ResultsBody = { assessmentId?: unknown; results?: unknown };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "TEACHER"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: ResultsBody;
  try { body = (await request.json()) as ResultsBody; } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId : "";
  const inputs = Array.isArray(body.results) ? body.results as ResultInput[] : null;
  if (!assessmentId || !inputs) return NextResponse.json({ error: "Assessment and results are required" }, { status: 400 });

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, ...(session.role === "TEACHER" ? { offering: { teacher: { userId: session.userId } } } : {}) },
    select: { id: true, maxMarks: true, offering: { select: { enrollments: { where: { status: "ENROLLED" }, select: { studentId: true } } } } },
  });
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  const enrolled = new Set(assessment.offering.enrollments.map((item) => item.studentId));
  const records = inputs.map((input) => ({ studentId: typeof input.studentId === "string" ? input.studentId : "", marks: typeof input.marks === "number" ? input.marks : -1, grade: typeof input.grade === "string" ? input.grade.trim() || null : null }));
  if (records.some((record) => !enrolled.has(record.studentId) || record.marks < 0 || record.marks > Number(assessment.maxMarks))) return NextResponse.json({ error: "Results contain an invalid student or mark" }, { status: 400 });
  try {
    const results = await prisma.$transaction(records.map((record) => prisma.result.upsert({ where: { assessmentId_studentId: { assessmentId, studentId: record.studentId } }, create: { assessmentId, ...record }, update: { marks: record.marks, grade: record.grade } })));
    return NextResponse.json({ results }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json({ error: "Unable to save results" }, { status: 400 });
    return NextResponse.json({ error: "Unable to save results" }, { status: 500 });
  }
}
