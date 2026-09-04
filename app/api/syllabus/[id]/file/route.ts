import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/syllabus/[id]/file — stream the stored PDF to any viewer (public).
 * `?inline=1` renders in-browser when the mime type is previewable.
 */
export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  try {
    const syllabus = await prisma.syllabus.findUnique({
      where: { id },
      select: { fileName: true, mimeType: true, fileData: true },
    });
    if (!syllabus) {
      return NextResponse.json({ error: "Syllabus not found" }, { status: 404 });
    }

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const contentType =
      inline && syllabus.mimeType && /^\w.+\/[\w.+-]+$/.test(syllabus.mimeType)
        ? syllabus.mimeType
        : "application/octet-stream";

    const safeName = syllabus.fileName.replace(/["\\\r\n]/g, "_");
    const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, "_");

    return new NextResponse(new Uint8Array(syllabus.fileData), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(syllabus.fileData.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("GET /api/syllabus/[id]/file error:", error);
    return NextResponse.json(
      { error: "Unable to download syllabus" },
      { status: 500 },
    );
  }
}
