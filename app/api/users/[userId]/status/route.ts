import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";

const StatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * PATCH /api/users/[userId]/status — activate / deactivate an account (admin only).
 *
 * Deactivation (INACTIVE) blocks sign-in (enforced by the login route) and
 * hides the profile from the directory; every record is preserved and the
 * account can be reactivated at any time.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: id } = await ctx.params;

  const parsed = await jsonBody(request, StatusSchema);
  if (!parsed.ok) return parsed.response;
  const { status } = parsed.value;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Deactivating yourself would lock you out of the admin panel.
  if (user.id === session.userId && status === "INACTIVE") {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PATCH /api/users/[id]/status error:", error);
    return NextResponse.json({ error: "Unable to update account status" }, { status: 500 });
  }
}
