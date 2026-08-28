import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/announcements/[id]/attachment — stream a notice attachment.
 * Published notices are public (the notices page is anonymous); drafts are
 * admin-only. `?inline=1` renders in-browser for previewable types.
 */
export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: {
        publishedAt: true,
        attachmentFileName: true,
        attachmentMimeType: true,
        attachmentData: true,
      },
    });

    if (!announcement || !announcement.attachmentData || !announcement.attachmentFileName) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const publishedAt = announcement.publishedAt;
    const isPublished = publishedAt !== null && publishedAt.getTime() <= Date.now();
    if (!isPublished) {
      const session = await getSession();
      if (session?.role !== "ADMIN") {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }
    }

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const contentType =
      announcement.attachmentMimeType &&
      /^[\w.+-]+\/[\w.+-]+$/.test(announcement.attachmentMimeType)
        ? announcement.attachmentMimeType
        : "application/octet-stream";

    const safeName = announcement.attachmentFileName.replace(/["\\\r\n]/g, "_");
    const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, "_");

    return new NextResponse(new Uint8Array(announcement.attachmentData), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(announcement.attachmentData.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("GET /api/announcements/[id]/attachment error:", error);
    return NextResponse.json({ error: "Unable to download attachment" }, { status: 500 });
  }
}