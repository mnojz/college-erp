import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/materials/[id]/bookmark — toggle the signed-in user's bookmark. */
export async function POST(_request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const material = await prisma.studyMaterial.findUnique({ where: { id }, select: { id: true } });
    if (!material) return NextResponse.json({ error: "Study material not found" }, { status: 404 });

    const existing = await prisma.bookmark.findUnique({
      where: { userId_studyMaterialId: { userId: session.userId, studyMaterialId: id } },
      select: { id: true },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ bookmarked: false });
    }

    await prisma.bookmark.create({
      data: { userId: session.userId, studyMaterialId: id },
    });
    return NextResponse.json({ bookmarked: true });
  } catch (error) {
    console.error("POST /api/materials/[id]/bookmark error:", error);
    return NextResponse.json({ error: "Unable to update bookmark" }, { status: 500 });
  }
}
