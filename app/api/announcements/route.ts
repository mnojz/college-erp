import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession, requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

type AttachmentWrite = {
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
  attachmentData?: Uint8Array<ArrayBuffer> | null;
};

type ParsedNoticeInput = {
  id: string | null;
  title: string;
  body: string;
  publishedAt: Date | null;
  publishedAtInvalid: boolean;
  file: File | null;
  removeAttachment: boolean;
};

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  body: true,
  publishedAt: true,
  createdAt: true,
  author: { select: { firstName: true, lastName: true } },
  attachmentFileName: true,
  attachmentMimeType: true,
  attachmentSize: true,
};

/** Accepts both multipart/form-data (with optional file) and JSON bodies. */
async function parseNoticeInput(request: Request): Promise<ParsedNoticeInput | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const id = form.get("id");
      const title = form.get("title");
      const body = form.get("body");
      const publishedRaw = form.get("publishedAt");
      const removeRaw = form.get("removeAttachment");
      const file = form.get("file");
      const publishedAt =
        publishedRaw === null || publishedRaw === "" ? null : new Date(String(publishedRaw));
      return {
        id: typeof id === "string" && id.trim() ? id.trim() : null,
        title: typeof title === "string" ? title.trim() : "",
        body: typeof body === "string" ? body.trim() : "",
        publishedAt,
        publishedAtInvalid: publishedAt !== null && Number.isNaN(publishedAt.getTime()),
        file: file instanceof File && file.size > 0 ? file : null,
        removeAttachment: removeRaw === "1" || removeRaw === "true",
      };
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const publishedRaw = raw.publishedAt;
    const publishedAt =
      publishedRaw === null || publishedRaw === undefined || publishedRaw === ""
        ? null
        : new Date(String(publishedRaw));
    return {
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : null,
      title: typeof raw.title === "string" ? raw.title.trim() : "",
      body: typeof raw.body === "string" ? raw.body.trim() : "",
      publishedAt,
      publishedAtInvalid: publishedAt !== null && Number.isNaN(publishedAt.getTime()),
      file: null,
      removeAttachment: raw.removeAttachment === true,
    };
  } catch {
    return null;
  }
}

function validateAttachment(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "Attachment must be 10 MB or smaller";
  }
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return "Attachments must be an image (PNG, JPEG, WEBP, GIF) or a PDF";
  }
  return null;
}

async function attachmentWriteFor(file: File): Promise<AttachmentWrite> {
  return {
    attachmentFileName: file.name,
    attachmentMimeType: file.type,
    attachmentSize: file.size,
    attachmentData: new Uint8Array(await file.arrayBuffer()),
  };
}

const ATTACHMENT_CLEAR: AttachmentWrite = {
  attachmentFileName: null,
  attachmentMimeType: null,
  attachmentSize: null,
  attachmentData: null,
};

export async function GET() {
  const session = await getSession();
  const announcements = await prisma.announcement.findMany({
    where: session?.role === "ADMIN" ? undefined : { publishedAt: { not: null, lte: new Date() } },
    orderBy: { createdAt: "desc" },
    select: ANNOUNCEMENT_SELECT,
  });
  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = await parseNoticeInput(request);
  if (!input) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, body: announcementBody, publishedAt } = input;
  if (!title || !announcementBody || input.publishedAtInvalid) {
    return NextResponse.json({ error: "Title and message content are required" }, { status: 400 });
  }

  if (input.file) {
    const attachmentError = validateAttachment(input.file);
    if (attachmentError) return NextResponse.json({ error: attachmentError }, { status: 400 });
  }

  try {
    const attachmentWrite = input.file ? await attachmentWriteFor(input.file) : {};
    const announcement = await prisma.announcement.create({
      data: { title, body: announcementBody, publishedAt, authorId: admin.userId, ...attachmentWrite },
      select: ANNOUNCEMENT_SELECT,
    });
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: "Unable to save announcement" }, { status: 400 });
    }
    console.error("POST /api/announcements error:", error);
    return NextResponse.json({ error: "Unable to create announcement" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = await parseNoticeInput(request);
  if (!input) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id, title, body: announcementBody, publishedAt } = input;
  if (!id || !title || !announcementBody || input.publishedAtInvalid) {
    return NextResponse.json({ error: "Announcement ID, title, and content are required" }, { status: 400 });
  }

  if (input.file) {
    const attachmentError = validateAttachment(input.file);
    if (attachmentError) return NextResponse.json({ error: attachmentError }, { status: 400 });
  }

  try {
    const attachmentWrite = input.file
      ? await attachmentWriteFor(input.file)
      : input.removeAttachment
        ? ATTACHMENT_CLEAR
        : {};
    const announcement = await prisma.announcement.update({
      where: { id },
      data: { title, body: announcementBody, publishedAt, ...attachmentWrite },
      select: ANNOUNCEMENT_SELECT,
    });
    return NextResponse.json({ announcement }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/announcements error:", error);
    return NextResponse.json({ error: "Unable to update announcement" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = (await request.json()) as { id?: string };
      id = body?.id ?? null;
    } catch {
      // url param
    }
  }

  if (!id) return NextResponse.json({ error: "Announcement ID is required" }, { status: 400 });

  try {
    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/announcements error:", error);
    return NextResponse.json({ error: "Unable to delete announcement" }, { status: 500 });
  }
}
