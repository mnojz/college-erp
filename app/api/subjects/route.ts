import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type SubjectBody = { name?: unknown; code?: unknown; programId?: unknown; semester?: unknown };

export async function GET() {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ program: { name: "asc" } }, { semester: "asc" }, { code: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      programId: true,
      semester: true,
      program: { select: { name: true, code: true } },
    },
  });
  return NextResponse.json({ subjects });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: SubjectBody;
  try {
    body = (await request.json()) as SubjectBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const programId = typeof body.programId === "string" ? body.programId : "";
  const semester = typeof body.semester === "number" ? body.semester : Number(body.semester);

  if (!name || !code || !programId || !Number.isInteger(semester) || semester < 1) {
    return NextResponse.json(
      { error: "Name, code, program, and a valid semester number are required" },
      { status: 400 },
    );
  }

  // Validate semester is within program's range
  const program = await prisma.program.findUnique({ where: { id: programId }, select: { durationYears: true } });
  if (!program) return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
  if (semester > program.durationYears * 2) {
    return NextResponse.json(
      { error: `Semester must be between 1 and ${program.durationYears * 2} for this program` },
      { status: 400 },
    );
  }

  try {
    const subject = await prisma.subject.create({
      data: { name, code, programId, semester },
      select: { id: true, name: true, code: true, programId: true, semester: true },
    });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Subject code is already registered" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create subject" }, { status: 500 });
  }
}
