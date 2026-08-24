import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type TermBody = { name?: unknown; number?: unknown; academicYearId?: unknown };

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: TermBody;
  try {
    body = (await request.json()) as TermBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const number = typeof body.number === "number" ? body.number : 0;
  const academicYearId = typeof body.academicYearId === "string" ? body.academicYearId : "";

  if (!name || !academicYearId || !Number.isInteger(number) || number < 1) {
    return NextResponse.json({ error: "Name, positive term number, and academic year are required" }, { status: 400 });
  }

  try {
    const term = await prisma.term.create({
      data: { name, number, academicYearId },
      include: { academicYear: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ term }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This term already exists for the academic year" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Academic year does not exist" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create term" }, { status: 500 });
  }
}

export async function GET() {
  const terms = await prisma.term.findMany({
    orderBy: [{ academicYear: { startsOn: "desc" } }, { number: "asc" }],
    select: {
      id: true,
      name: true,
      number: true,
      academicYear: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ terms });
}
