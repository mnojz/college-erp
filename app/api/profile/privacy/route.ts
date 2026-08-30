import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  defaultSettingsForRole,
  userControlledKeysForRole,
  type FieldVisibility,
  type RoleName,
} from "@/app/lib/profile-shared";

const VISIBILITIES: FieldVisibility[] = ["PUBLIC", "PRIVATE"];

/**
 * PATCH /api/profile/privacy — the owner toggles visibility of their own
 * USER-controlled profile fields. Any RESTRICTED or unknown key is rejected:
 * institution-controlled data can never be made public, not even on request.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Admin accounts have no privacy settings" }, { status: 403 });
  }

  const role = session.role as RoleName;
  const allowed = new Set(userControlledKeysForRole(role));

  let body: { updates?: Record<string, unknown> };
  try {
    body = (await request.json()) as { updates?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const updates = body.updates;
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return NextResponse.json({ error: "Field `updates` is required" }, { status: 400 });
  }

  const valid: { fieldKey: string; visibility: FieldVisibility }[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.has(key)) {
      return NextResponse.json(
        { error: `Field "${key}" is not yours to publish` },
        { status: 400 },
      );
    }
    if (typeof value !== "string" || !VISIBILITIES.includes(value as FieldVisibility)) {
      return NextResponse.json({ error: `Invalid visibility for "${key}"` }, { status: 400 });
    }
    valid.push({ fieldKey: key, visibility: value as FieldVisibility });
  }

  try {
    await prisma.$transaction(
      valid.map((item) =>
        prisma.profilePrivacy.upsert({
          where: { userId_fieldKey: { userId: session.userId, fieldKey: item.fieldKey } },
          update: { visibility: item.visibility },
          create: { userId: session.userId, fieldKey: item.fieldKey, visibility: item.visibility },
        }),
      ),
    );

    const stored = await prisma.profilePrivacy.findMany({
      where: { userId: session.userId },
      select: { fieldKey: true, visibility: true },
    });
    const settings = {
      ...defaultSettingsForRole(role),
      ...Object.fromEntries(stored.map((row) => [row.fieldKey, row.visibility as FieldVisibility])),
    };
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("PATCH /api/profile/privacy error:", error);
    return NextResponse.json({ error: "Unable to update privacy settings" }, { status: 500 });
  }
}