import { NextResponse } from "next/server";
import { Prisma, type DayOfWeek } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ClassBody = {
  subjectId?: unknown;
  teacherId?: unknown;
  programId?: unknown;
  semester?: unknown;
  dayOfWeek?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

function parseTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value)
    ? new Date(`1970-01-01T${value}:00.000Z`)
    : null;
}

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      orderBy: [
        { program: { code: "asc" } },
        { semester: "asc" },
        { subject: { code: "asc" } },
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        subjectId: true,
        teacherId: true,
        programId: true,
        semester: true,
        subject: { select: { name: true, code: true } },
        program: { select: { name: true, code: true } },
        teacher: {
          select: {
            employeeNo: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    return NextResponse.json({ classes });
  } catch (error) {
    console.error("GET /api/classes error:", error);
    return NextResponse.json({ error: "Unable to load classes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ClassBody;
  try {
    body = (await request.json()) as ClassBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const programId = typeof body.programId === "string" ? body.programId : "";
  const semester =
    typeof body.semester === "number" ? body.semester : Number(body.semester);
  const dayOfWeek =
    typeof body.dayOfWeek === "string" && days.includes(body.dayOfWeek as DayOfWeek)
      ? (body.dayOfWeek as DayOfWeek)
      : null;
  const startTime = parseTime(body.startTime);
  const endTime = parseTime(body.endTime);

  if (
    !subjectId ||
    !teacherId ||
    !programId ||
    !Number.isInteger(semester) ||
    semester < 1 ||
    !dayOfWeek ||
    !startTime ||
    !endTime ||
    startTime >= endTime
  ) {
    return NextResponse.json(
      { error: "Subject, teacher, program, semester, weekday, and a valid time range are required" },
      { status: 400 },
    );
  }

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, programId, semester },
    select: { id: true },
  });
  if (!subject) {
    return NextResponse.json(
      { error: "Subject must belong to the selected program and semester" },
      { status: 400 },
    );
  }

  try {
    const classRecord = await prisma.class.create({
      data: {
        subjectId,
        teacherId,
        programId,
        semester,
        dayOfWeek,
        startTime,
        endTime,
      },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        semester: true,
      },
    });
    return NextResponse.json({ class: classRecord }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This class already exists" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Teacher or program does not exist" }, { status: 400 });
    }
    console.error("POST /api/classes error:", error);
    return NextResponse.json({ error: "Unable to create class" }, { status: 500 });
  }
}
