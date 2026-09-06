import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type BreakBody = {
  id?: unknown;
  programId?: unknown;
  semester?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

function parseTime(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value)
    ? new Date(`1970-01-01T${value}:00.000Z`)
    : null;
}

/**
 * GET /api/breaks — break windows for every program+semester timetable.
 * Public (like GET /api/classes): the read-only student timetable needs it.
 */
export async function GET() {
  try {
    const breaks = await prisma.break.findMany({
      orderBy: [{ program: { code: "asc" } }, { semester: "asc" }],
      select: { id: true, programId: true, semester: true, startTime: true, endTime: true },
    });
    return NextResponse.json({ breaks });
  } catch (error) {
    console.error("GET /api/breaks error:", error);
    return NextResponse.json({ error: "Unable to load breaks" }, { status: 500 });
  }
}

/**
 * POST /api/breaks — set the break window for a program+semester timetable
 * (at most one per timetable). From then on, /api/classes rejects any class
 * overlapping this window on any weekday.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: BreakBody;
  try {
    body = (await request.json()) as BreakBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const programId = typeof body.programId === "string" ? body.programId : "";
  const semester = typeof body.semester === "number" ? body.semester : Number(body.semester);
  const startTime = parseTime(body.startTime);
  const endTime = parseTime(body.endTime);

  if (!programId || !Number.isInteger(semester) || !startTime || !endTime) {
    return NextResponse.json(
      { error: "Program, semester, start time, and end time are required" },
      { status: 400 },
    );
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  try {
    const breakRow = await prisma.break.create({
      data: { programId, semester, startTime, endTime },
      select: { id: true, programId: true, semester: true, startTime: true, endTime: true },
    });
    return NextResponse.json({ break: breakRow }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A break is already set for this timetable. Click it on the table to edit it." },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
    }
    console.error("POST /api/breaks error:", error);
    return NextResponse.json({ error: "Unable to set the break" }, { status: 500 });
  }
}

/** PUT /api/breaks — move/edit the break window's start and end time. */
export async function PUT(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: BreakBody;
  try {
    body = (await request.json()) as BreakBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const startTime = parseTime(body.startTime);
  const endTime = parseTime(body.endTime);

  if (!id || !startTime || !endTime) {
    return NextResponse.json(
      { error: "Break ID, start time, and end time are required" },
      { status: 400 },
    );
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  try {
    const breakRow = await prisma.break.update({
      where: { id },
      data: { startTime, endTime },
      select: { id: true, programId: true, semester: true, startTime: true, endTime: true },
    });
    return NextResponse.json({ break: breakRow });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Break not found" }, { status: 404 });
    }
    console.error("PUT /api/breaks error:", error);
    return NextResponse.json({ error: "Unable to update the break" }, { status: 500 });
  }
}

/** DELETE /api/breaks?id= — remove the break window (frees the time again). */
export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = (await request.json()) as { id?: string };
      id = body?.id ?? null;
    } catch {
      // url param
    }
  }

  if (!id) return NextResponse.json({ error: "Break ID is required" }, { status: 400 });

  try {
    await prisma.break.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Break removed successfully" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Break not found" }, { status: 404 });
    }
    console.error("DELETE /api/breaks error:", error);
    return NextResponse.json({ error: "Unable to remove the break" }, { status: 500 });
  }
}