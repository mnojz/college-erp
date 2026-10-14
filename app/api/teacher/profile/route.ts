import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { compare, hash } from "bcryptjs";

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      employeeNo: true,
      profileImageUrl: true,
      phone: true,
      office: true,
      bio: true,
      qualification: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          pendingAvatarUrl: true,
          profileReviewStatus: true,
          lastAvatarRejectedAt: true,
        },
      },
      subjectTeachers: {
        select: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
              semester: true,
            },
          },
        },
      },
      classes: {
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          semester: true,
          subjectId: true,
          programId: true,
          subject: { select: { id: true, name: true, code: true } },
          program: {
            select: {
              id: true,
              name: true,
              code: true,
              departmentName: true,
              durationYears: true,
              students: {
                where: { status: "ACTIVE" },
                select: { id: true },
              },
            },
          },
          _count: { select: { sessions: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
    },
  });

  if (!teacher) {
    return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
  }

  const subjectIds = teacher.classes.map((c) => c.subject.id);
  const totalExamSubjects = await prisma.examSubject.count({
    where: { subjectId: { in: subjectIds } },
  });

  // Calculate unique student count across all assigned classes
  const studentIdSet = new Set<string>();
  for (const c of teacher.classes) {
    for (const s of c.program.students) {
      studentIdSet.add(s.id);
    }
  }

  return NextResponse.json({
    teacher,
    stats: {
      totalClasses: teacher.classes.length,
      totalAssessments: totalExamSubjects,
      totalStudents: studentIdSet.size,
      totalSubjects: new Set(teacher.classes.map((c) => c.subject.id)).size,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session || session.role !== "TEACHER") {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const office = typeof body.office === "string" ? body.office.trim() : undefined;
  const bio = typeof body.bio === "string" ? body.bio.trim() : undefined;
  const qualification = typeof body.qualification === "string" ? body.qualification.trim() : undefined;

  const currentPassword =
    typeof body.currentPassword === "string" && body.currentPassword !== ""
      ? body.currentPassword
      : undefined;
  const newPassword =
    typeof body.newPassword === "string" && body.newPassword !== ""
      ? body.newPassword
      : undefined;

  if (newPassword && newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (newPassword && !currentPassword) {
    return NextResponse.json(
      { error: "Enter your current password to change it" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.teacher.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        user: { select: { id: true, passwordHash: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    }

    if (newPassword && currentPassword) {
      const match = await compare(currentPassword, existing.user.passwordHash);
      if (!match) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      const newHash = await hash(newPassword, 10);
      await prisma.user.update({
        where: { id: existing.user.id },
        data: { passwordHash: newHash },
      });
    }

    const updated = await prisma.teacher.update({
      where: { userId: session.userId },
      data: {
        ...(phone !== undefined ? { phone } : {}),
        ...(office !== undefined ? { office } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(qualification !== undefined ? { qualification } : {}),
      },
      select: {
        id: true,
        employeeNo: true,
        phone: true,
        office: true,
        bio: true,
        qualification: true,
        profileImageUrl: true,
      },
    });

    return NextResponse.json({ ok: true, teacher: updated });
  } catch (err: unknown) {
    console.error("PATCH /api/teacher/profile error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
