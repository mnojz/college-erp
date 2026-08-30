import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getProfileForViewer } from "@/app/lib/profile-server";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * GET /api/users/[userId]/profile — anyone's profile, masked for the viewer.
 * Self and admins receive every field; everyone else receives only fields
 * allowed by the owner's settings and role policy (see profile-shared.ts).
 */
export async function GET(_request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { userId } = await ctx.params;

  try {
    const result = await getProfileForViewer(session, userId);
    if (!result) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/users/[userId]/profile error:", error);
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}