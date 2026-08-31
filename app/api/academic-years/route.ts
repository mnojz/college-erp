import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { parsePageParams, paginatedResponse } from "@/app/lib/pagination";

const UpsertBodySchema = z.object({
  name: z.string().trim().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isCurrent: z.boolean().optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
});

const PatchBodySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  isCurrent: z.boolean().optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
});

const yearSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isCurrent: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

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
        select: { ...yearSelect, _count: { select: { semesters: true } } },
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

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await jsonBody(request, UpsertBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (body.isCurrent) {
        await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      }
      return tx.academicYear.create({
        data: {
          name: body.name,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          isCurrent: body.isCurrent ?? false,
          status: body.status ?? "ACTIVE",
        },
        select: yearSelect,
      });
    });
    return NextResponse.json({ academicYear: created }, { status: 201 });
  } catch (error) {
    const e = error as { code?: string };
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Academic year name already exists" }, { status: 409 });
    }
    console.error("POST /api/academic-years error:", error);
    return NextResponse.json({ error: "Unable to create academic year" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await jsonBody(request, PatchBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (body.isCurrent) {
        await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      }
      return tx.academicYear.update({
        where: { id: body.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.startDate ? { startDate: new Date(body.startDate) } : {}),
          ...(body.endDate ? { endDate: new Date(body.endDate) } : {}),
          ...(body.isCurrent !== undefined ? { isCurrent: body.isCurrent } : {}),
          ...(body.status ? { status: body.status } : {}),
        },
        select: yearSelect,
      });
    });
    return NextResponse.json({ academicYear: updated });
  } catch (error) {
    const e = error as { code?: string };
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Academic year not found" }, { status: 404 });
    }
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Academic year name already exists" }, { status: 409 });
    }
    console.error("PATCH /api/academic-years error:", error);
    return NextResponse.json({ error: "Unable to update academic year" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = (await request.json()) as { id?: string };
      id = body?.id ?? null;
    } catch {
      /* no body — fall through to validation */
    }
  }
  if (!id) return NextResponse.json({ error: "Academic year ID is required" }, { status: 400 });

  try {
    const count = await prisma.studentSemester.count({ where: { academicYearId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} enrollment records reference this academic year` },
        { status: 409 },
      );
    }
    await prisma.academicYear.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const e = error as { code?: string };
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Academic year not found" }, { status: 404 });
    }
    console.error("DELETE /api/academic-years error:", error);
    return NextResponse.json({ error: "Unable to delete academic year" }, { status: 500 });
  }
}
