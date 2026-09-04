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
  subjectIds?: unknown;
};

type UpdateTeacherBody = {
  id?: unknown;
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  employeeNo?: unknown;
  profileImageUrl?: unknown;
  subjectIds?: unknown;
  // Portal access — ACTIVE users can sign in, INACTIVE are locked out.
  status?: unknown;
};

/** Normalise an optional `subjectIds` payload into a de-duplicated list. */
function parseSubjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      const id = item.trim();
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

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
  const subjectIds = parseSubjectIds(body.subjectIds);

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

      const created = await transaction.teacher.create({
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

      if (subjectIds.length > 0) {
        await transaction.subjectTeacher.createMany({
          data: subjectIds.map((subjectId) => ({
            subjectId,
            teacherId: created.id,
          })),
          skipDuplicates: true,
        });
      }

      return { teacher: created, subjectIds };
    });

    return NextResponse.json({ teacher: teacher.teacher, subjectIds: teacher.subjectIds }, { status: 201 });
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
  const subjectIds = parseSubjectIds(body.subjectIds);

  // Portal access — ACTIVE users can sign in, INACTIVE are locked out.
  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const status = statusRaw === "ACTIVE" || statusRaw === "INACTIVE" ? statusRaw : undefined;

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
        ...(status ? { status } : {}),
      };

      if (password) {
        userData.passwordHash = await hash(password, 12);
      }

      await tx.user.update({
        where: { id: existingTeacher.userId },
        data: userData,
      });

      const updated = await tx.teacher.update({
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

      // Replace the full set of subject assignments (delete + recreate).
      await tx.subjectTeacher.deleteMany({ where: { teacherId: id } });
      if (subjectIds.length > 0) {
        await tx.subjectTeacher.createMany({
          data: subjectIds.map((subjectId) => ({ subjectId, teacherId: id })),
          skipDuplicates: true,
        });
      }

      return updated;
    });

    return NextResponse.json(
      { teacher: updatedTeacher, subjectIds },
      { status: 200 },
    );
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

      await tx.subjectTeacher.deleteMany({ where: { teacherId: id } });
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
        subjectTeachers: {
          select: {
            id: true,
            subject: {
              select: {
                id: true,
                code: true,
                name: true,
                semester: true,
                program: { select: { code: true, name: true } },
              },
            },
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
