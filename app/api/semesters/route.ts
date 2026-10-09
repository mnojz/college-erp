import { NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getActiveSemesters } from "@/app/lib/progression";

/**
 * GET /api/semesters?programId=xxx[&activeOnly=1]
 *
 * Without activeOnly: the full THEORETICAL range (durationYears × 2) — for
 * curriculum data (subjects, materials, syllabus) that exists whether or not
 * a batch is enrolled.
 *
 * With activeOnly=1: only semesters that currently have ACTIVE students
 * ("the semester in the list exists if the students exist") — for
 * batch-dependent pickers (people filter, attendance, class creation).
 */
export async function GET(request: Request) {
  // Teachers need activeOnly for their attendance/class pickers; the full
  // range was already admin-only, so any signed-in user may call this.
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");
    const activeOnly = searchParams.get("activeOnly") === "1";

    if (activeOnly) {
      const numbers = await getActiveSemesters(prisma, programId ?? undefined);
      return NextResponse.json({
        semesters: numbers.map((n) => ({ number: n, name: `Semester ${n}` })),
      });
    }

    if (programId) {
      const program = await prisma.program.findUnique({
        where: { id: programId },
        select: { durationYears: true },
      });
      if (!program) {
        return NextResponse.json({ error: "Program not found" }, { status: 404 });
      }
      const total = program.durationYears * 2;
      const semesters = Array.from({ length: total }, (_, i) => ({
        number: i + 1,
        name: `Semester ${i + 1}`,
      }));
      return NextResponse.json({ semesters });
    }

    // No programId: return all programs with their semester ranges
    const programs = await prisma.program.findMany({
      select: { id: true, name: true, code: true, durationYears: true },
    });
    const semesters = programs.flatMap((p) =>
      Array.from({ length: p.durationYears * 2 }, (_, i) => ({
        number: i + 1,
        name: `Semester ${i + 1}`,
        programId: p.id,
        programName: p.name,
        programCode: p.code,
      })),
    );
    return NextResponse.json({ semesters });
  } catch (error) {
    console.error("GET /api/semesters error:", error);
    return NextResponse.json({ error: "Unable to load semesters" }, { status: 500 });
  }
}

/** POST is no longer needed — semesters are derived, not stored. */
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(
    { error: "Semesters are now derived from the program's duration and do not need to be created manually." },
    { status: 410 },
  );
}
