import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { canViewerAccessMaterial } from "@/app/lib/materials-server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/materials/[id]/file — stream the stored file after an access check.
 * Access mirrors listing rules: everyone / dept-program / specific classes,
 * plus owners & admins always retain access. `?inline=1` renders in-browser
 * when the mime type is previewable.
 */
export async function GET(request: Request, ctx: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!(await canViewerAccessMaterial(session, id))) {
    return NextResponse.json({ error: "Study material not found" }, { status: 404 });
  }

  try {
    const material = await prisma.studyMaterial.findUnique({
      where: { id },
      select: { fileName: true, mimeType: true, fileData: true },
    });
    if (!material) return NextResponse.json({ error: "Study material not found" }, { status: 404 });

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const contentType =
      inline && material.mimeType && /^[\w.+-]+\/[\w.+-]+$/.test(material.mimeType)
        ? material.mimeType
        : "application/octet-stream";

    const safeName = material.fileName.replace(/["\\\r\n]/g, "_");
    const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, "_");

    return new NextResponse(new Uint8Array(material.fileData), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(material.fileData.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("GET /api/materials/[id]/file error:", error);
    return NextResponse.json({ error: "Unable to download study material" }, { status: 500 });
  }
}
