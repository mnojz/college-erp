import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { parsePageParams, paginatedResponse } from "@/app/lib/pagination";

const AdvanceBodySchema = z.object({
  studentId: z.string().trim().min(1),
  semester: z.coerce.number().int().min(1),
  academicYearId: z.string().trim().optional(),
});

const FilterSchema = z.object({
  studentId: z.string().trim().optional(),
  academicYearId: z.string().trim().optional(),
});

/**
 * GET /api/student-semesters — list a student's academic-history rows, the
 * source of truth for enrollment across academic years. Admin-only.
 */
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip, limit } = parsePageParams(searchParams, { pageSize: 50 });

  const parsed = FilterSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  const f = parsed.data;

  const where: Prisma.StudentSemesterWhereInput = {
    ...(f.studentId ? { studentId: f.studentId } : {}),
    ...(f.academicYearId ? { academicYearId: f.academicYearId } : {}),
  };

  try {
    const [rows, total] = await Promise.all([
      prisma.studentSemester.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ semesterNo: "asc" }, { academicYear: { name: "asc" } }],
        select: {
          id: true,
          studentId: true,
          academicYearId: true,
          semesterNo: true,
          startDate: true,
          endDate: true,
          status: true,
          createdAt: true,
          student: {
            select: {
              enrollmentNumber: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          academicYear: { select: { id: true, name: true, isCurrent: true, status: true } },
        },
      }),
      prisma.studentSemester.count({ where }),
    ]);

    const { items, pagination } = paginatedResponse(rows, total, page, pageSize);
    return NextResponse.json({ studentSemesters: items, pagination });
  } catch (error) {
    console.error("GET /api/student-semesters error:", error);
    return NextResponse.json({ error: "Unable to load student semesters" }, { status: 500 });
  }
}

/**
 * POST /api/student-semesters — advance a student to a new semester number.
 * Unlike the old single-integer overwrite, this records the move as history:
 * the previously-ACTIVE row for this academic year (lower semester) is closed
 * as COMPLETED, a new ACTIVE row is created/upserted, and Student.currentSemester
 * is kept in sync as a cache for the many eligibility filters still keyed on it.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await jsonBody(request, AdvanceBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  try {
    const student = await prisma.student.findUnique({
      where: { id: body.studentId },
      select: {
        programId: true,
        currentSemester: true,
        status: true,
        program: { select: { durationYears: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const maxSemester = student.program ? student.program.durationYears * 2 : 8;
    if (body.semester > maxSemester || body.semester < 1) {
      return NextResponse.json(
        { error: `Semester must be between 1 and ${maxSemester} for this program` },
        { status: 400 },
      );
    }

    let academicYearId = body.academicYearId;
    if (!academicYearId) {
      const current = await prisma.academicYear.findFirst({
        where: { isCurrent: true, status: "ACTIVE" },
        select: { id: true },
      });
      if (!current) {
        return NextResponse.json(
          { error: "No current academic year is set; pass academicYearId" },
          { status: 400 },
        );
      }
      academicYearId = current.id;
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      // Close any previously-ACTIVE semester for this academic year that is lower.
      await tx.studentSemester.updateMany({
        where: {
          studentId: body.studentId,
          academicYearId,
          status: "ACTIVE",
          semesterNo: { lt: body.semester },
        },
        data: { status: "COMPLETED", endDate: now },
      });

      await tx.studentSemester.upsert({
        where: {
          studentId_academicYearId_semesterNo: {
            studentId: body.studentId,
            academicYearId,
            semesterNo: body.semester,
          },
        },
        update: { status: "ACTIVE", startDate: now, endDate: null },
        create: {
          studentId: body.studentId,
          academicYearId,
          semesterNo: body.semester,
          status: "ACTIVE",
          startDate: now,
        },
      });

      // Keep the cached currentSemester in sync (source of truth = StudentSemester).
      return tx.student.update({
        where: { id: body.studentId },
        data: { currentSemester: body.semester },
        select: { id: true, enrollmentNumber: true, currentSemester: true, status: true },
      });
    });

    return NextResponse.json({ student: result }, { status: 200 });
  } catch (error) {
    const e = error as { code?: string };
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Academic year not found" }, { status: 404 });
    }
    console.error("POST /api/student-semesters error:", error);
    return NextResponse.json({ error: "Unable to update student semester" }, { status: 500 });
  }
}
