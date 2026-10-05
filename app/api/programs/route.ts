import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getDepartmentId } from "@/app/lib/department";
import { jsonBody } from "@/app/lib/validation";
import { z } from "zod";

const ArchiveBodySchema = z.object({
  id: z.string().trim().min(1),
  archived: z.boolean(),
});

type ProgramBody = {
  id?: unknown;
  name?: unknown;
  code?: unknown;
  durationYears?: unknown;
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ProgramBody;
  try {
    body = (await request.json()) as ProgramBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const durationYears = typeof body.durationYears === "number" ? body.durationYears : 0;

  // Single-department mode: programs are auto-assigned to the one department.
  const departmentId = await getDepartmentId();

  if (!name || !code || !departmentId || !Number.isInteger(durationYears) || durationYears < 1) {
    return NextResponse.json(
      { error: "Name, code, and a positive duration are required. Set up your department first." },
      { status: 400 },
    );
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    return NextResponse.json({ error: "Department is not set up yet" }, { status: 400 });
  }

  try {
    const program = await prisma.program.create({
      data: { name, code, durationYears, departmentId, departmentName: department.name },
    });
    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Program code is already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create program" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ProgramBody;
  try {
    body = (await request.json()) as ProgramBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const durationYears = typeof body.durationYears === "number" ? body.durationYears : 0;

  // Single-department mode: keep the existing department assignment on edit.
  const departmentId = await getDepartmentId();

  if (!id || !name || !code || !departmentId || !Number.isInteger(durationYears) || durationYears < 1) {
    return NextResponse.json(
      { error: "Program ID, name, code, and a positive duration are required" },
      { status: 400 },
    );
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    return NextResponse.json({ error: "Department is not set up yet" }, { status: 400 });
  }

  try {
    const program = await prisma.program.update({
      where: { id },
      data: { name, code, durationYears, departmentId, departmentName: department.name },
    });
    return NextResponse.json({ program }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Program code is already registered by another program" }, { status: 409 });
    }
    console.error("PUT /api/programs error:", error);
    return NextResponse.json({ error: "Unable to update program" }, { status: 500 });
  }
}

/**
 * DELETE /api/programs — permanently remove a program.
 *
 * Previously this ran a manual 8-step cascade (attendance records → sessions →
 * classes → results → assessments → unassign students → subjects → program),
 * so a single misclick destroyed a whole term of records with no way back.
 *
 * Now it is refused whenever the program is actually in use, and the admin is
 * pointed at archiving instead. A true delete remains available only for an
 * empty program, where there is nothing to lose.
 */
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
      // url param checked
    }
  }

  if (!id) {
    return NextResponse.json({ error: "Program ID is required" }, { status: 400 });
  }

  const program = await prisma.program.findUnique({
    where: { id },
    select: {
      id: true,
      archivedAt: true,
      _count: { select: { students: true, classes: true, assessments: true } },
    },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const { students, classes, assessments } = program._count;
  if (students || classes || assessments) {
    return NextResponse.json(
      {
        error:
          "This program is still in use. Archive it instead — archiving hides it from every " +
          "picker while keeping all subjects, classes, attendance and results intact.",
        inUse: { students, classes, assessments },
        canArchive: true,
      },
      { status: 409 },
    );
  }

  try {
    await prisma.program.delete({ where: { id: program.id } });
    return NextResponse.json({ success: true, message: "Program deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/programs error:", error);
    return NextResponse.json({ error: "Unable to delete program" }, { status: 500 });
  }
}
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "1";

  const programs = await prisma.program.findMany({
    where: includeArchived ? undefined : { archivedAt: null },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      durationYears: true,
      departmentName: true,
      archivedAt: true,
      archivedBy: true,
    },
  });

  return NextResponse.json({ programs });
}

/**
 * PATCH /api/programs — archive or restore a program.
 *
 * Archiving is non-destructive: nothing is deleted, the program simply stops
 * being offered for teaching. Restoring brings it straight back.
 */
export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await jsonBody(request, ArchiveBodySchema);
  if (!parsed.ok) return parsed.response;
  const { id, archived } = parsed.value;

  const existing = await prisma.program.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  try {
    const program = await prisma.program.update({
      where: { id: existing.id },
      data: {
        archivedAt: archived ? new Date() : null,
        archivedBy: archived ? session.userId : null,
      },
      select: { id: true, name: true, code: true, durationYears: true, departmentName: true, archivedAt: true, archivedBy: true },
    });
    return NextResponse.json({ program });
  } catch (error) {
    console.error("PATCH /api/programs error:", error);
    return NextResponse.json({ error: "Unable to archive program" }, { status: 500 });
  }
}
