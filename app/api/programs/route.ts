import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ProgramBody = {
  id?: unknown;
  name?: unknown;
  code?: unknown;
  durationYears?: unknown;
  departmentId?: unknown;
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
  const departmentId = typeof body.departmentId === "string" ? body.departmentId.trim() : "";

  if (!name || !code || !departmentId || !Number.isInteger(durationYears) || durationYears < 1) {
    return NextResponse.json(
      { error: "Name, code, department, and a positive duration are required" },
      { status: 400 },
    );
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    return NextResponse.json({ error: "Selected department does not exist" }, { status: 400 });
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
  const departmentId = typeof body.departmentId === "string" ? body.departmentId.trim() : "";

  if (!id || !name || !code || !departmentId || !Number.isInteger(durationYears) || durationYears < 1) {
    return NextResponse.json(
      { error: "Program ID, name, code, department, and a positive duration are required" },
      { status: 400 },
    );
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    return NextResponse.json({ error: "Selected department does not exist" }, { status: 400 });
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

  try {
    await prisma.$transaction(async (tx) => {
      // Find classes for this program
      const classes = await tx.class.findMany({ where: { programId: id }, select: { id: true } });
      const classIds = classes.map((c) => c.id);
      if (classIds.length > 0) {
        await tx.attendanceRecord.deleteMany({ where: { session: { classId: { in: classIds } } } });
        await tx.attendanceSession.deleteMany({ where: { classId: { in: classIds } } });
        await tx.class.deleteMany({ where: { programId: id } });
      }

      // Assessments
      const assessments = await tx.assessment.findMany({ where: { programId: id }, select: { id: true } });
      const assessmentIds = assessments.map((a) => a.id);
      if (assessmentIds.length > 0) {
        await tx.result.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
        await tx.assessment.deleteMany({ where: { programId: id } });
      }

      // Unassign students from this program
      await tx.student.updateMany({ where: { programId: id }, data: { programId: null } });

      // Delete subjects
      await tx.subject.deleteMany({ where: { programId: id } });

      // Delete program
      await tx.program.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, message: "Program deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/programs error:", error);
    return NextResponse.json({ error: "Unable to delete program" }, { status: 500 });
  }
}

export async function GET() {
  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      durationYears: true,
      departmentName: true,
    },
  });

  return NextResponse.json({ programs });
}
