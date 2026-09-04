import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type DepartmentBody = {
  name?: unknown;
  code?: unknown;
};

/**
 * Single-department mode: GET returns the single department (or null if not set up yet).
 */
export async function GET() {
  try {
    const department = await prisma.department.findFirst({
      select: {
        id: true,
        name: true,
        code: true,
        _count: { select: { programs: true } },
      },
    });
    return NextResponse.json({
      department: department
        ? { ...department, programCount: department._count.programs }
        : null,
    });
  } catch (error) {
    console.error("GET /api/departments error:", error);
    return NextResponse.json({ error: "Unable to load department" }, { status: 500 });
  }
}

/**
 * Single-department mode: POST creates the department only if none exists.
 * Once set, it cannot be changed through this endpoint.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if department already exists
  const existing = await prisma.department.findFirst();
  if (existing) {
    return NextResponse.json({ error: "Department is already set. Use the edit action on the department card to change it." }, { status: 409 });
  }

  let body: DepartmentBody;
  try {
    body = (await request.json()) as DepartmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!name || !code) {
    return NextResponse.json({ error: "Department name and code are required" }, { status: 400 });
  }

  try {
    const department = await prisma.department.create({ data: { name, code } });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A department with this name or code already exists" }, { status: 409 });
    }
    console.error("POST /api/departments error:", error);
    return NextResponse.json({ error: "Unable to create department" }, { status: 500 });
  }
}

/**
 * Single-department mode: PUT updates the department's name and/or code.
 * The record (and its id) stays the same, so all existing program, subject,
 * class and user references keep working.
 */
export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.department.findFirst();
  if (!existing) {
    return NextResponse.json({ error: "Department not set up yet" }, { status: 404 });
  }

  let body: DepartmentBody;
  try {
    body = (await request.json()) as DepartmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!name || !code) {
    return NextResponse.json({ error: "Department name and code are required" }, { status: 400 });
  }

  try {
    const department = await prisma.department.update({
      where: { id: existing.id },
      data: { name, code },
    });
    return NextResponse.json({ department });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A department with this name or code already exists" }, { status: 409 });
    }
    console.error("PUT /api/departments error:", error);
    return NextResponse.json({ error: "Unable to update department" }, { status: 500 });
  }
}
