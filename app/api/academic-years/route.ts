import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type AcademicYearBody = { name?: unknown; startsOn?: unknown; endsOn?: unknown };

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: AcademicYearBody;
  try {
    body = (await request.json()) as AcademicYearBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const startsOn = typeof body.startsOn === "string" ? new Date(body.startsOn) : null;
  const endsOn = typeof body.endsOn === "string" ? new Date(body.endsOn) : null;

  if (!name || !startsOn || !endsOn || Number.isNaN(startsOn.getTime()) || Number.isNaN(endsOn.getTime()) || startsOn >= endsOn) {
    return NextResponse.json({ error: "Valid name, start date, and end date are required" }, { status: 400 });
  }

  try {
    const academicYear = await prisma.academicYear.create({ data: { name, startsOn, endsOn } });
    return NextResponse.json({ academicYear }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Academic year already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create academic year" }, { status: 500 });
  }
}

export async function GET() {
  const academicYears = await prisma.academicYear.findMany({
    orderBy: { startsOn: "desc" },
    select: { id: true, name: true, startsOn: true, endsOn: true },
  });
  return NextResponse.json({ academicYears });
}
