import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const RoutineSchema = z.object({
  entries: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
        subjectId: z.string().trim().min(1),
      }),
    )
    .min(1, "Add at least one routine entry"),
});

/**
 * POST /api/admin/exams/[id]/routine — replace the session's routine. Dates are
 * entered manually by the admin (arbitrary gaps between papers); `order` is the
 * array index, which is the day sequence shown to students.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = await jsonBody(request, RoutineSchema);
  if (!parsed.ok) return parsed.response;

  const session = await prisma.examSession.findUnique({
    where: { id },
    select: { id: true, semester: true, subjects: { select: { subjectId: true } } },
  });
  if (!session) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });

  const allowedSubjectIds = new Set(session.subjects.map((s) => s.subjectId));
  if (parsed.value.entries.some((e) => !allowedSubjectIds.has(e.subjectId))) {
    return NextResponse.json({ error: "Routine references a subject not in this exam" }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.examRoutineEntry.deleteMany({ where: { sessionId: id } }),
      prisma.examRoutineEntry.createMany({
        data: parsed.value.entries.map((entry, index) => ({
          sessionId: id,
          subjectId: entry.subjectId,
          date: new Date(`${entry.date}T00:00:00Z`),
          order: index,
        })),
      }),
    ]);
    return NextResponse.json({ success: true, count: parsed.value.entries.length });
  } catch (error) {
    console.error("POST /api/admin/exams/[id]/routine error:", error);
    return NextResponse.json({ error: "Unable to save routine" }, { status: 500 });
  }
}

/** GET /api/admin/exams/[id]/routine — the current routine (for preview). */
export async function GET(_request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const routine = await prisma.examRoutineEntry.findMany({
    where: { sessionId: id },
    orderBy: { order: "asc" },
    select: {
      id: true,
      date: true,
      order: true,
      subject: { select: { code: true, name: true } },
    },
  });
  return NextResponse.json({ routine });
}