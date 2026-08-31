import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { parsePageParams, paginatedResponse } from "@/app/lib/pagination";

const QuerySchema = z.object({
  subject: z.string().trim().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const RESULT_SELECT = {
  id: true,
  marks: true,
  grade: true,
  assessment: {
    select: {
      id: true,
      name: true,
      semester: true,
      maxMarks: true,
      assessmentDate: true,
      subject: { select: { id: true, code: true, name: true } },
      program: { select: { name: true } },
    },
  },
} satisfies Prisma.ResultSelect;

/**
 * GET /api/student/results — the signed-in student's published assessment
 * results, newest first. Supports pagination plus optional subject/semester/
 * date-range filters:
 *   ?page=1&pageSize=50&subject=CS101&semester=3&from=2024-01-01&to=2024-12-31
 * Returns { results, subjects, summary, pagination } — `subjects` is the
 * distinct subject list behind ALL of the student's results (drives the page
 * filter) and `summary` is computed across the full result set, independent
 * of the current page/filters.
 */
export async function GET(request: Request) {
  const session = await requireRole("STUDENT");
  if (!session) {
    return NextResponse.json({ error: "Student access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip, limit } = parsePageParams(searchParams, { pageSize: 50 });

  // Treat empty query values (e.g. ?subject=&semester=) as "no filter".
  const rawQuery = Object.fromEntries(
    [...searchParams.entries()].filter(([, value]) => value !== ""),
  );
  const parsed = QuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  const f = parsed.data;

  try {
    const student = await prisma.student.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const assessmentWhere: Prisma.AssessmentWhereInput = {
      ...(f.subject ? { subject: { code: f.subject } } : {}),
      ...(f.semester ? { semester: f.semester } : {}),
      ...(f.from || f.to
        ? {
            assessmentDate: {
              ...(f.from ? { gte: f.from } : {}),
              ...(f.to ? { lte: f.to } : {}),
            },
          }
        : {}),
    };
    const where: Prisma.ResultWhereInput = {
      studentId: student.id,
      assessment: assessmentWhere,
    };

    const [results, total, subjectRows, allResults] = await Promise.all([
      prisma.result.findMany({
        where,
        orderBy: [
          { assessment: { assessmentDate: "desc" } },
          { assessment: { name: "asc" } },
        ],
        skip,
        take: limit,
        select: RESULT_SELECT,
      }),
      prisma.result.count({ where }),
      // Distinct subjects across the student's FULL result set (ignores the
      // current filters so the dropdown never hides the option in use).
      prisma.assessment.findMany({
        where: { results: { some: { studentId: student.id } } },
        distinct: ["subjectId"],
        select: { subject: { select: { code: true, name: true } } },
      }),
      // Unpaginated marks for the header summary cards.
      prisma.result.findMany({
        where: { studentId: student.id },
        select: { marks: true, assessment: { select: { maxMarks: true } } },
      }),
    ]);

    const subjects = subjectRows
      .map((row) => row.subject)
      .sort((a, b) => a.code.localeCompare(b.code));

    const averagePercentage =
      allResults.length > 0
        ? Number(
            (
              allResults.reduce(
                (acc, r) => acc + (Number(r.marks) / Number(r.assessment.maxMarks)) * 100,
                0,
              ) / allResults.length
            ).toFixed(1),
          )
        : 0;

    const { items, pagination } = paginatedResponse(results, total, page, pageSize);

    return NextResponse.json({
      results: items,
      subjects,
      summary: { totalAssessments: allResults.length, averagePercentage },
      pagination,
    });
  } catch (error) {
    console.error("GET /api/student/results error:", error);
    return NextResponse.json({ error: "Unable to load results" }, { status: 500 });
  }
}
