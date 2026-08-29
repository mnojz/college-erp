import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type DepartmentBody = {
  id?: unknown;
  name?: unknown;
  code?: unknown;
};

/** List every department (with program counts). Read-only, like /api/programs GET. */
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        _count: { select: { programs: true } },
      },
    });
    return NextResponse.json({
      departments: departments.map(({ _count, ...d }) => ({ ...d, programCount: _count.programs })),
    });
  } catch (error) {
    console.error("GET /api/departments error:", error);
    return NextResponse.json({ error: "Unable to load departments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: DepartmentBody;
  try {
    body = (await request.json()) as DepartmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!id || !name || !code) {
    return NextResponse.json({ error: "Department ID, name, and code are required" }, { status: 400 });
  }

  try {
    const department = await prisma.department.update({ where: { id }, data: { name, code } });
    // Keep the denormalized display name on programs in sync after a rename.
    await prisma.program.updateMany({
      where: { departmentId: id },
      data: { departmentName: name },
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

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
  }

  try {
    const programCount = await prisma.program.count({ where: { departmentId: id } });
    if (programCount > 0) {
      return NextResponse.json(
        { error: `This department still has ${programCount} program${programCount === 1 ? "" : "s"} attached. Reassign or delete them first.` },
        { status: 409 },
      );
    }

    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Department deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/departments error:", error);
    return NextResponse.json({ error: "Unable to delete department" }, { status: 500 });
  }
}
