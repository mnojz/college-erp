import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  advanceStudentTx,
  getCohortSummaries,
  graduateStudentTx,
  previewCohortAdvance,
  requireCurrentAcademicYear,
} from "@/app/lib/progression";

/**
 * GET /api/progression/cohorts — every active (program, semester) cohort with
 * headcounts. Powers the setup-page progression cards.
 */
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("programId");
  const from = searchParams.get("fromSemester");

  try {
    // Preview mode: ?programId=…&fromSemester=N returns who would move.
    if (programId && from !== null) {
      const fromSemester = Number(from);
      if (!Number.isInteger(fromSemester) || fromSemester < 1) {
        return NextResponse.json({ error: "fromSemester must be a positive integer" }, { status: 400 });
      }
      const preview = await previewCohortAdvance(prisma, programId, fromSemester);
      return NextResponse.json({ preview });
    }

    const cohorts = await getCohortSummaries(prisma);
    let currentYear: { id: string; name: string } | null = null;
    try {
      currentYear = await requireCurrentAcademicYear(prisma);
    } catch {
      currentYear = null;
    }
    return NextResponse.json({ cohorts, currentYear });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("NOT_FOUND:") || msg.startsWith("EMPTY:")) {
      return NextResponse.json({ error: msg.slice(msg.indexOf(":") + 1) }, { status: 404 });
    }
    console.error("GET /api/progression/cohorts error:", error);
    return NextResponse.json({ error: "Unable to load cohorts" }, { status: 500 });
  }
}

const AdvanceBodySchema = z.object({
  programId: z.string().trim().min(1),
  fromSemester: z.coerce.number().int().min(1),
});

/**
 * POST /api/progression/cohorts — advance (or graduate) a whole cohort.
 *
 * The preview MUST be shown first: the client fetches GET with
 * ?programId=&fromSemester= and only calls this after admin confirmation.
 * Everything runs in one transaction — a failure mid-cohort rolls back clean.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof AdvanceBodySchema>;
  try {
    body = AdvanceBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "programId and fromSemester are required" }, { status: 400 });
  }

  try {
    // Re-resolve inside the handler so the preview can't go stale: students
    // admitted/removed between preview and confirm change the outcome.
    const preview = await previewCohortAdvance(prisma, body.programId, body.fromSemester);
    let year: { id: string; name: string } | null = null;
    if (!preview.graduates) {
      year = await requireCurrentAcademicYear(prisma);
    }

    const now = new Date();
    const moved = await prisma.$transaction(async (tx) => {
      for (const s of preview.students) {
        if (preview.graduates) {
          await graduateStudentTx(tx, s.id, now);
        } else {
          await advanceStudentTx(tx, s.id, preview.toSemester as number, (year as { id: string }).id, now);
        }
      }
      return preview.students.length;
    });

    return NextResponse.json({
      success: true,
      moved,
      graduates: preview.graduates,
      fromSemester: preview.fromSemester,
      toSemester: preview.toSemester,
      programCode: preview.programCode,
      academicYear: year?.name ?? null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("NOT_FOUND:") || msg.startsWith("EMPTY:")) {
      return NextResponse.json({ error: msg.slice(msg.indexOf(":") + 1) }, { status: 404 });
    }
    if (msg.startsWith("NO_CURRENT_YEAR:")) {
      return NextResponse.json(
        { error: "No current academic year is set — create one before advancing cohorts" },
        { status: 400 },
      );
    }
    console.error("POST /api/progression/cohorts error:", error);
    return NextResponse.json({ error: "Unable to advance cohort" }, { status: 500 });
  }
}
