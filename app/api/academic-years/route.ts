import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { parsePageParams, paginatedResponse } from "@/app/lib/pagination";

/**
 * GET /api/academic-years — read-only list of auto-managed academic-year
 * labels, for history filters and display. Academic years are fully
 * automatic (created/rolled over by intake inside its transaction), so
 * there are intentionally no POST/PATCH/DELETE endpoints.
 */

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip, limit } = parsePageParams(searchParams, { pageSize: 50 });

  try {
    const [items, total, current] = await Promise.all([
      prisma.academicYear.findMany({
        orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { semesters: true } },
        },
      }),
      prisma.academicYear.count(),
      prisma.academicYear.findFirst({
        where: { isCurrent: true },
        select: { id: true, name: true },
      }),
    ]);

    const { items: years, pagination } = paginatedResponse(items, total, page, pageSize);
    return NextResponse.json({ academicYears: years, current, pagination });
  } catch (error) {
    console.error("GET /api/academic-years error:", error);
    return NextResponse.json({ error: "Unable to load academic years" }, { status: 500 });
  }
}
