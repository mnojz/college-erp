import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type CreateTeacherBody = {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  employeeNo?: unknown;
  profileImageUrl?: unknown;
};

type UpdateTeacherBody = {
  id?: unknown;
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  employeeNo?: unknown;
  profileImageUrl?: unknown;
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateTeacherBody;

  try {
    body = (await request.json()) as CreateTeacherBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const employeeNo = typeof body.employeeNo === "string" ? body.employeeNo.trim() : "";
  const profileImageUrl = typeof body.profileImageUrl === "string" ? body.profileImageUrl.trim() : undefined;

  if (!email || !password || !firstName || !lastName || !employeeNo) {
    return NextResponse.json(
      { error: "Email, password, name, and employee number are required" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  try {
    const teacher = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email,
          passwordHash: await hash(password, 12),
          firstName,
          lastName,
          role: "TEACHER",
        },
      });

      return transaction.teacher.create({
        data: {
          userId: user.id,
          employeeNo,
          profileImageUrl,
        },
        select: {
          id: true,
          employeeNo: true,
          profileImageUrl: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Email or employee number is already registered" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Unable to create teacher" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: UpdateTeacherBody;
  try {
    body = (await request.json()) as UpdateTeacherBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const employeeNo = typeof body.employeeNo === "string" ? body.employeeNo.trim() : "";
  const profileImageUrl = typeof body.profileImageUrl === "string" ? body.profileImageUrl.trim() : null;

  if (!id || !email || !firstName || !lastName || !employeeNo) {
    return NextResponse.json(
      { error: "Teacher ID, email, name, and employee number are required" },
      { status: 400 },
    );
  }

  if (password && password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters if provided" },
      { status: 400 },
    );
  }

  const existingTeacher = await prisma.teacher.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!existingTeacher) {
    return NextResponse.json({ error: "Teacher record not found" }, { status: 404 });
  }

  try {
    const updatedTeacher = await prisma.$transaction(async (tx) => {
      const userData: Prisma.UserUpdateInput = {
        email,
        firstName,
        lastName,
      };

      if (password) {
        userData.passwordHash = await hash(password, 12);
      }

      await tx.user.update({
        where: { id: existingTeacher.userId },
        data: userData,
      });

      return tx.teacher.update({
        where: { id },
        data: {
          employeeNo,
          profileImageUrl: profileImageUrl || null,
        },
        select: {
          id: true,
          employeeNo: true,
          profileImageUrl: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ teacher: updatedTeacher }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Email or employee number is already in use by another account" },
        { status: 409 },
      );
    }
    console.error("PUT /api/teachers error:", error);
    return NextResponse.json({ error: "Unable to update teacher record" }, { status: 500 });
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
      // url param was already null
    }
  }

  if (!id) {
    return NextResponse.json({ error: "Teacher ID is required" }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Find classes taught by this teacher
      const classes = await tx.class.findMany({
        where: { teacherId: id },
        select: { id: true },
      });
      const classIds = classes.map((c) => c.id);

      if (classIds.length > 0) {
        // Delete attendance records and sessions for these classes
        await tx.attendanceRecord.deleteMany({
          where: { session: { classId: { in: classIds } } },
        });
        await tx.attendanceSession.deleteMany({
          where: { classId: { in: classIds } },
        });
        await tx.class.deleteMany({
          where: { teacherId: id },
        });
      }

      await tx.teacher.delete({ where: { id } });
      await tx.user.delete({ where: { id: teacher.userId } });
    });

    return NextResponse.json({ success: true, message: "Faculty account deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/teachers error:", error);
    return NextResponse.json({ error: "Unable to delete faculty account" }, { status: 500 });
  }
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const teachers = await prisma.teacher.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        employeeNo: true,
        profileImageUrl: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ teachers });
  } catch (error) {
    console.error("GET /api/teachers error:", error);
    return NextResponse.json({ error: "Unable to load teachers" }, { status: 500 });
  }
}
