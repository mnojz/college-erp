import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type CreateStudentBody = {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  enrollmentNumber?: unknown;
  registrationId?: unknown;
  rollNumber?: unknown;
  profileImageUrl?: unknown;
  admissionDate?: unknown;
  programId?: unknown;
  currentSemester?: unknown;
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateStudentBody;
  try {
    body = (await request.json()) as CreateStudentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const enrollmentNumber = typeof body.enrollmentNumber === "string" ? body.enrollmentNumber.trim() : "";
  const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
  const rollNumber = typeof body.rollNumber === "string" ? body.rollNumber.trim() : undefined;
  const profileImageUrl = typeof body.profileImageUrl === "string" ? body.profileImageUrl.trim() : undefined;
  const admissionDate = typeof body.admissionDate === "string" ? new Date(body.admissionDate) : null;
  const programId = typeof body.programId === "string" ? body.programId : undefined;
  const currentSemester =
    typeof body.currentSemester === "number"
      ? body.currentSemester
      : typeof body.currentSemester === "string" && body.currentSemester !== ""
        ? Number(body.currentSemester)
        : undefined;

  if (!email || !password || !firstName || !lastName || !enrollmentNumber || !registrationId || !admissionDate) {
    return NextResponse.json(
      { error: "Email, password, name, enrollment number, registration ID, and admission date are required" },
      { status: 400 },
    );
  }

  if (Number.isNaN(admissionDate.getTime())) {
    return NextResponse.json({ error: "Admission date is invalid" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Validate semester range against program if both provided
  if (programId && currentSemester !== undefined) {
    const program = await prisma.program.findUnique({ where: { id: programId }, select: { durationYears: true } });
    if (!program) return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
    if (currentSemester < 1 || currentSemester > program.durationYears * 2) {
      return NextResponse.json(
        { error: `Semester must be between 1 and ${program.durationYears * 2} for this program` },
        { status: 400 },
      );
    }
  }

  try {
    const { hash } = await import("bcryptjs");
    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash: await hash(password, 12), firstName, lastName, role: "STUDENT" },
      });
      return tx.student.create({
        data: { userId: user.id, enrollmentNumber, registrationId, rollNumber, profileImageUrl, admissionDate, programId, currentSemester },
        select: {
          id: true, enrollmentNumber: true, registrationId: true, rollNumber: true, profileImageUrl: true,
          admissionDate: true, programId: true, currentSemester: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      });
    });
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email, enrollment number, registration ID, or roll number is already registered" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
    }
    console.error("POST /api/students error:", error);
    return NextResponse.json({ error: "Unable to create student" }, { status: 500 });
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, enrollmentNumber: true, registrationId: true, rollNumber: true,
        profileImageUrl: true, admissionDate: true, programId: true, currentSemester: true,
        program: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
      },
    });
    return NextResponse.json({ students });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json({ error: "Unable to load students" }, { status: 500 });
  }
}
