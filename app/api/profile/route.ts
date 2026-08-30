import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { getProfileForViewer } from "@/app/lib/profile-server";

/** GET /api/profile — the signed-in user's own full profile + privacy settings. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const result = await getProfileForViewer(session, session.userId);
    if (!result) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}