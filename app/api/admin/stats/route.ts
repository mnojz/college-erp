import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/admin/stats — one aggregate payload for the admin Overview dashboard.
 *
 * Replaces the old approach of firing six separate list endpoints and calling
 * `.length` in the browser. The students endpoint paginates, so that counted
 * only the first page (25 of 42) — totals here are true counts, and the chart
 * distributions (by program / semester / lifecycle) come back in a single
 * round-trip.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [
      students,
      teachers,
      programs,
      subjects,
      classes,
      assessments,
      studentsByProgram,
      studentsBySemester,
      lifecycleCounts,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.program.count({ where: { archivedAt: null } }),
      prisma.subject.count(),
      prisma.class.count(),
      prisma.assessment.count(),
      // Distribution: active students grouped by program (drives the bar chart).
      prisma.student.groupBy({
        by: ["programId"],
        where: { status: "ACTIVE", programId: { not: null } },
        _count: { _all: true },
      }),
      // Distribution: active students grouped by semester (drives the bar chart).
      prisma.student.groupBy({
        by: ["currentSemester"],
        where: { status: "ACTIVE", currentSemester: { not: null } },
        _count: { _all: true },
      }),
      // Lifecycle split for the donut: active / graduated / dropped.
      prisma.student.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    // Resolve program codes for the by-program distribution.
    const programIds = studentsByProgram.map((g) => g.programId).filter((id): id is string => id != null);
    const programRows = programIds.length
      ? await prisma.program.findMany({
          where: { id: { in: programIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const programById = new Map(programRows.map((p) => [p.id, p]));

    const byProgram = studentsByProgram
      .map((g) => ({
        programId: g.programId as string,
        code: programById.get(g.programId as string)?.code ?? "—",
        name: programById.get(g.programId as string)?.name ?? "Unknown",
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const bySemester = studentsBySemester
      .map((g) => ({ semester: g.currentSemester as number, count: g._count._all }))
      .sort((a, b) => a.semester - b.semester);

    const lifecycle = {
      active: lifecycleCounts.find((g) => g.status === "ACTIVE")?._count._all ?? 0,
      graduated: lifecycleCounts.find((g) => g.status === "GRADUATED")?._count._all ?? 0,
      dropped: lifecycleCounts.find((g) => g.status === "DROPPED")?._count._all ?? 0,
    };

    return NextResponse.json({
      totals: { students, teachers, programs, subjects, classes, assessments },
      byProgram,
      bySemester,
      lifecycle,
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Unable to load dashboard statistics" }, { status: 500 });
  }
}
