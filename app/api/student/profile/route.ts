import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

const PROFILE_SELECT = {
  id: true,
  enrollmentNumber: true,
  registrationId: true,
  rollNumber: true,
  profileImageUrl: true,
  admissionDate: true,
  programEnrollmentStatus: true,
  programId: true,
  currentSemester: true,
  // Personal information (admin-entered)
  gender: true,
  bloodGroup: true,
  nationality: true,
  religion: true,
  category: true,
  // Contact details (student-editable)
  phone: true,
  currentAddress: true,
  permanentAddress: true,
  emergencyContact: true,
  // Guardian / parent details (student-editable)
  fatherName: true,
  motherName: true,
  guardianPhone: true,
  guardianEmail: true,
  guardianRelation: true,
  program: {
    select: {
      id: true,
      name: true,
      code: true,
      durationYears: true,
      departmentName: true,
    },
  },
  user: {
    select: {
      email: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  },
} as const;

/**
 * Fields a student is allowed to change themselves.
 * Critical data (name, gender, registration number, nationality, category,
 * religion, program, semester, …) are intentionally NOT in this list — they
 * are only ever set by an admin, so a broken/fake form cannot corrupt them.
 */
const SELF_EDITABLE = new Set([
  "profileImageUrl",
  "bloodGroup",
  "phone",
  "currentAddress",
  "permanentAddress",
  "emergencyContact",
  "fatherName",
  "motherName",
  "guardianPhone",
  "guardianEmail",
  "guardianRelation",
]);

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { userId: session.userId },
      select: PROFILE_SELECT,
    });

    return student
      ? NextResponse.json({ student })
      : NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  } catch (error) {
    console.error("GET /api/student/profile error:", error);
    return NextResponse.json({ error: "Unable to load student profile" }, { status: 500 });
  }
}
/**
 * PATCH /api/student/profile — student edits their own profile.
 *
 * Only keys present in SELF_EDITABLE are honoured (plus `email` and changing
 * the password on the linked User account). Anything else in the body — name,
 * gender, nationality, category, religion, registration data, program, etc. —
 * is silently ignored, so a student can never modify admin-controlled data.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Student access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate email if provided.
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  if (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  const newPassword =
    typeof body.newPassword === "string" && body.newPassword !== "" ? body.newPassword : undefined;
  const currentPassword =
    typeof body.currentPassword === "string" && body.currentPassword !== "" ? body.currentPassword : undefined;

  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }
  if (!newPassword && email !== undefined && !currentPassword) {
    return NextResponse.json({ error: "Enter your current password to change your email" }, { status: 400 });
  }
  if (newPassword && !currentPassword) {
    return NextResponse.json({ error: "Enter your current password to change it" }, { status: 400 });
  }
try {
    const existing = await prisma.student.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        userId: true,
        user: { select: { email: true, passwordHash: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    // If a password (or email) change was requested, verify the current password.
    if ((newPassword || email !== undefined) && currentPassword) {
      const { compare } = await import("bcryptjs");
      const ok = await compare(currentPassword, existing.user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
    }

    // Build the student update from SELF_EDITABLE keys only.
    const studentData: Prisma.StudentUpdateInput = {};
    for (const key of SELF_EDITABLE) {
      const raw = body[key];
      const value = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
      (studentData as Record<string, unknown>)[key] = value;
    }

    await prisma.$transaction(async (tx) => {
      if (email !== undefined || newPassword) {
        const userData: Prisma.UserUpdateInput = {};
        if (email !== undefined) userData.email = email;
        if (newPassword) {
          const { hash } = await import("bcryptjs");
          userData.passwordHash = await hash(newPassword, 12);
        }
        await tx.user.update({ where: { id: existing.userId }, data: userData });
      }

      await tx.student.update({ where: { id: existing.id }, data: studentData });
    });

    const updated = await prisma.student.findUnique({
      where: { id: existing.id },
      select: PROFILE_SELECT,
    });
    return NextResponse.json({ student: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That email address is already in use" }, { status: 409 });
    }
    console.error("PATCH /api/student/profile error:", error);
    return NextResponse.json({ error: "Unable to update profile" }, { status: 500 });
  }
}
