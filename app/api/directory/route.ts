import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import type { DirectoryEntry, RoleName } from "@/app/lib/profile-shared";

/**
 * GET /api/directory?q=&role= — campus people search (students + faculty).
 * Only always-visible identity fields are returned; details live on the
 * masked profile page. Admins are excluded (they are portal accounts, not
 * campus people).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const roleParam = searchParams.get("role");
  const roleFilter: RoleName[] =
    roleParam === "STUDENT" || roleParam === "TEACHER" ? [roleParam] : ["STUDENT", "TEACHER"];

  const where: Prisma.UserWhereInput = {
    role: { in: roleFilter },
    status: "ACTIVE",
  };
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        student: {
          select: {
            profileImageUrl: true,
            currentSemester: true,
            program: { select: { name: true } },
          },
        },
        teacher: { select: { profileImageUrl: true } },
      },
      orderBy: [{ role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
      take: 200,
    });

    const entries: DirectoryEntry[] = users.map((user) => {
      const isStudent = user.role === "STUDENT";
      const subtitle = isStudent && user.student
        ? [
            user.student.program?.name ?? null,
            user.student.currentSemester ? `Semester ${user.student.currentSemester}` : null,
          ]
            .filter((part): part is string => part !== null)
            .join(" · ") || "Student"
        : "Faculty member";

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role as RoleName,
        subtitle,
        photoUrl: user.student?.profileImageUrl ?? user.teacher?.profileImageUrl ?? null,
      };
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET /api/directory error:", error);
    return NextResponse.json({ error: "Unable to load directory" }, { status: 500 });
  }
}