import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/semesters?programId=xxx
 * Returns the list of valid semester numbers for a program
 * (derived from program.durationYears * 2, no DB table needed).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");

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
