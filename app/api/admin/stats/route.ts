import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/admin/stats — aggregate institutional metrics for the admin dashboard.
 * Delivers totals, distributions (programs, semesters, lifecycle, gender, weekly load, attendance),
 * and recent administrative activities in a single optimized round-trip.
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
      exams,
      pendingReviews,
      totalAttendance,
      presentAttendance,
      studentsByProgram,
      studentsBySemester,
      lifecycleCounts,
      classesByDay,
      examStatusCounts,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.program.count({ where: { archivedAt: null } }),
      prisma.subject.count(),
      prisma.class.count(),
      prisma.examSession.count(),
      prisma.user.count({ where: { profileReviewStatus: "PENDING_REVIEW" } }),
      prisma.attendanceRecord.count(),
      prisma.attendanceRecord.count({ where: { status: "PRESENT" } }),
      // Distribution: active students grouped by program
      prisma.student.groupBy({
        by: ["programId"],
        where: { status: "ACTIVE", programId: { not: null } },
        _count: { _all: true },
      }),
      // Distribution: active students grouped by semester
      prisma.student.groupBy({
        by: ["currentSemester"],
        where: { status: "ACTIVE", currentSemester: { not: null } },
        _count: { _all: true },
      }),
      // Lifecycle split: active / graduated / dropped
      prisma.student.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      // Weekly class distribution across days
      prisma.class.groupBy({
        by: ["dayOfWeek"],
        _count: { _all: true },
      }),
      // Exam session status split
      prisma.examSession.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    // Resolve program codes for the by-program distribution
    const programIds = studentsByProgram
      .map((g) => g.programId)
      .filter((id): id is string => id != null);
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

    const attendanceRate =
      totalAttendance > 0 ? (presentAttendance / totalAttendance) * 100 : 0;

    const daysOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
    const weeklyLoad = daysOrder.map((day) => {
      const match = classesByDay.find((c) => c.dayOfWeek === day);
      return {
        day,
        shortDay: day.slice(0, 3),
        count: match?._count._all ?? 0,
      };
    });

    const examStats = {
      draft: examStatusCounts.find((e) => e.status === "DRAFT")?._count._all ?? 0,
      announced: examStatusCounts.find((e) => e.status === "ANNOUNCED")?._count._all ?? 0,
      published:
        examStatusCounts.find((e) => e.status === "RESULTS_PUBLISHED")?._count._all ?? 0,
    };

    return NextResponse.json({
      totals: {
        students,
        teachers,
        programs,
        subjects,
        classes,
        assessments: exams,
        pendingReviews,
        attendanceRate: Number(attendanceRate.toFixed(1)),
        totalAttendance,
      },
      byProgram,
      bySemester,
      lifecycle,
      weeklyLoad,
      examStats,
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json(
      { error: "Unable to load dashboard statistics" },
      { status: 500 },
    );
  }
}
