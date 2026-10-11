import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

/**
 * PATCH /api/admin/password — change the signed-in admin's own password.
 *
 * Requires an ADMIN session plus the current password (verified against the
 * stored hash), mirroring the student self-service flow. The new password
 * must be at least 8 characters.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current password and new password are required" },
      { status: 400 },
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const ok = await compare(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(newPassword, 12) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/password error:", error);
    return NextResponse.json({ error: "Unable to change password" }, { status: 500 });
  }
}
