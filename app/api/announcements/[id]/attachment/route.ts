import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/announcements/[id]/attachment — stream a notice attachment.
 * Published campus-wide notices are public (the notices page is anonymous);
 * drafts are admin-only; teacher-scoped attachments require a matching
 * audience (the publishing teacher, an admin, or a student in the target
 * program + semester).
 */
export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: {
        publishedAt: true,
        teacherId: true,
        authorId: true,
        programId: true,
        semester: true,
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
    const session = await getSession();

    const isScoped = announcement.teacherId !== null;
    const isAdmin = session?.role === "ADMIN";
    const isOwner = session != null && announcement.authorId === session.userId;

    // Unpublished drafts → admins only. Teacher-scoped rows are always
    // published at creation, so this branch effectively covers admin drafts.
    if (!isPublished && !isAdmin) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Scoped (teacher) attachments: allow the owner/admin or a student in the
    // target program + semester.
    if (isScoped) {
      if (isAdmin || isOwner) {
        // allowed below
      } else if (session?.role === "STUDENT") {
        const student = await prisma.student.findUnique({
          where: { userId: session.userId },
          select: { programId: true, currentSemester: true },
        });
        const matchesScope =
          student?.programId != null &&
          student.currentSemester != null &&
          student.programId === announcement.programId &&
          student.currentSemester === announcement.semester;
        if (!matchesScope) {
          return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
        }
      } else {
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

    const fileBytes = new Uint8Array(announcement.attachmentData);
    const totalBytes = fileBytes.byteLength;
    const rangeHeader = request.headers.get("range");

    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalBytes - 1;

      if (!isNaN(start) && start < totalBytes) {
        const chunkEnd = Math.min(end, totalBytes - 1);
        const chunkSize = chunkEnd - start + 1;
        const chunk = fileBytes.subarray(start, chunkEnd + 1);

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${chunkEnd}/${totalBytes}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    return new NextResponse(fileBytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalBytes),
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/announcements/[id]/attachment error:", error);
    return NextResponse.json({ error: "Unable to download attachment" }, { status: 500 });
  }
}