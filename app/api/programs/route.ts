import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ProgramBody = {
  name?: unknown;
  code?: unknown;
  durationYears?: unknown;
  departmentName?: unknown;
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
  const departmentName = typeof body.departmentName === "string" ? body.departmentName.trim() : "";

  if (!name || !code || !departmentName || !Number.isInteger(durationYears) || durationYears < 1) {
    return NextResponse.json(
      { error: "Name, code, department name, and a positive duration are required" },
      { status: 400 },
    );
  }

  try {
    const program = await prisma.program.create({
      data: { name, code, durationYears, departmentName },
    });
    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Program code is already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create program" }, { status: 500 });
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
