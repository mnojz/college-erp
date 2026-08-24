import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type OfferingBody = {
  courseId?: unknown;
  termId?: unknown;
  teacherId?: unknown;
  programId?: unknown;
  section?: unknown;
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: OfferingBody;
  try {
    body = (await request.json()) as OfferingBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const courseId = typeof body.courseId === "string" ? body.courseId : "";
  const termId = typeof body.termId === "string" ? body.termId : "";
  const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
  const programId = typeof body.programId === "string" ? body.programId : undefined;
  const section = typeof body.section === "string" && body.section.trim()
    ? body.section.trim().toUpperCase()
    : "A";

  if (!courseId || !termId || !teacherId) {
    return NextResponse.json(
      { error: "Course, term, and teacher are required" },
      { status: 400 },
    );
  }

  try {
    const offering = await prisma.courseOffering.create({
      data: { courseId, termId, teacherId, programId, section },
      include: {
        course: { select: { id: true, code: true, name: true } },
        term: { select: { id: true, name: true, number: true } },
        teacher: {
          select: {
            id: true,
            employeeNo: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        program: { select: { id: true, name: true, code: true } },
      },
    });
    return NextResponse.json({ offering }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This course offering already exists" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Course, term, teacher, or program does not exist" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create course offering" }, { status: 500 });
  }
}

export async function GET() {
  const offerings = await prisma.courseOffering.findMany({
    orderBy: [{ term: { number: "asc" } }, { course: { code: "asc" } }],
    select: {
      id: true,
      section: true,
      course: { select: { id: true, code: true, name: true } },
      term: { select: { id: true, name: true, number: true, academicYear: { select: { name: true } } } },
      teacher: {
        select: {
          id: true,
          employeeNo: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      program: { select: { id: true, name: true, code: true } },
    },
  });
  return NextResponse.json({ offerings });
}
