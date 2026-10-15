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

    const ext = material.fileName.split(".").pop()?.toLowerCase() ?? "";
    let mime = material.mimeType;

    // Resolve MIME type for video and other common formats if missing or generic
    if (!mime || mime === "application/octet-stream") {
      const mimeMap: Record<string, string> = {
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        mkv: "video/x-matroska",
        ogv: "video/ogg",
        avi: "video/x-msvideo",
        m4v: "video/mp4",
        wmv: "video/x-ms-wmv",
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        svg: "image/svg+xml",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        m4a: "audio/mp4",
        txt: "text/plain",
      };
      if (mimeMap[ext]) {
        mime = mimeMap[ext];
      }
    }

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const contentType =
      inline && mime && /^[\w.+-]+\/[\w.+-]+$/.test(mime)
        ? mime
        : "application/octet-stream";

    const safeName = material.fileName.replace(/["\\\r\n]/g, "_");
    const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, "_");
    const totalLength = material.fileData.byteLength;
    const rangeHeader = request.headers.get("range");

    // Support HTTP Range requests (vital for <video> playback, seeking, and browser compatibility)
    if (inline && rangeHeader && rangeHeader.startsWith("bytes=")) {
      const match = rangeHeader.replace(/bytes=/, "").trim();
      const [startStr, endStr] = match.split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : totalLength - 1;

      if (!isNaN(start) && start >= 0 && start < totalLength && end >= start && end < totalLength) {
        const chunkSize = end - start + 1;
        const chunk = material.fileData.subarray(start, end + 1);

        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${totalLength}`,
            "Content-Length": String(chunkSize),
            "Accept-Ranges": "bytes",
            "Content-Disposition": `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }

    return new NextResponse(new Uint8Array(material.fileData), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalLength),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("GET /api/materials/[id]/file error:", error);
    return NextResponse.json({ error: "Unable to download study material" }, { status: 500 });
  }
}
