import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession, requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type AssessmentBody = { offeringId?: unknown; name?: unknown; maxMarks?: unknown; assessmentDate?: unknown };

async function canManageOffering(offeringId: string) {
  const session = await getSession();
  if (!session) return false;
  if (session.role === "ADMIN") return true;
  if (session.role !== "TEACHER") return false;
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (!teacher) return false;
  return Boolean(await prisma.courseOffering.findFirst({ where: { id: offeringId, teacherId: teacher.id }, select: { id: true } }));
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const assessments = await prisma.assessment.findMany({
    where: session.role === "TEACHER" ? { offering: { teacher: { userId: session.userId } } } : undefined,
    orderBy: { assessmentDate: "desc" },
    select: { id: true, name: true, maxMarks: true, assessmentDate: true, offering: { select: { id: true, course: { select: { code: true, name: true } }, term: { select: { name: true } } } } },
  });
  return NextResponse.json({ assessments });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  let body: AssessmentBody;
  try { body = (await request.json()) as AssessmentBody; } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const offeringId = typeof body.offeringId === "string" ? body.offeringId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const maxMarks = typeof body.maxMarks === "number" ? body.maxMarks : 0;
  const assessmentDate = typeof body.assessmentDate === "string" ? new Date(body.assessmentDate) : null;
  if (!admin && !(await canManageOffering(offeringId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!offeringId || !name || maxMarks <= 0 || (assessmentDate && Number.isNaN(assessmentDate.getTime()))) return NextResponse.json({ error: "Offering, name, positive marks, and valid date are required" }, { status: 400 });
  try {
    const assessment = await prisma.assessment.create({ data: { offeringId, name, maxMarks, assessmentDate }, select: { id: true, name: true, maxMarks: true, assessmentDate: true, offeringId: true } });
    return NextResponse.json({ assessment }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Assessment already exists for this offering" }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return NextResponse.json({ error: "Course offering does not exist" }, { status: 400 });
    return NextResponse.json({ error: "Unable to create assessment" }, { status: 500 });
  }
}
