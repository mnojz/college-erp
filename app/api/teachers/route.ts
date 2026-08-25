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
