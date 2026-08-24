import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type CourseBody = {
  code?: unknown;
  name?: unknown;
  credits?: unknown;
  departmentId?: unknown;
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CourseBody;
  try {
    body = (await request.json()) as CourseBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const credits = typeof body.credits === "number" ? body.credits : 0;
  const departmentId = typeof body.departmentId === "string" ? body.departmentId : "";

  if (!code || !name || !departmentId || !Number.isInteger(credits) || credits < 1) {
    return NextResponse.json(
      { error: "Code, name, department, and positive credits are required" },
      { status: 400 },
    );
  }

  try {
    const course = await prisma.course.create({
      data: { code, name, credits, departmentId },
      include: { department: { select: { id: true, name: true, code: true } } },
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Course code is already registered" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Department does not exist" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create course" }, { status: 500 });
  }
}

export async function GET() {
  const courses = await prisma.course.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      credits: true,
      department: { select: { id: true, name: true, code: true } },
    },
  });
  return NextResponse.json({ courses });
}
