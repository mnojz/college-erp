import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession, requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type AnnouncementBody = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  publishedAt?: unknown;
};

export async function GET() {
  const session = await getSession();
  const announcements = await prisma.announcement.findMany({
    where: session?.role === "ADMIN" ? undefined : { publishedAt: { not: null, lte: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { firstName: true, lastName: true } },
    },
  });
  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: AnnouncementBody;
  try {
    body = (await request.json()) as AnnouncementBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const announcementBody = typeof body.body === "string" ? body.body.trim() : "";
  const publishedAt = body.publishedAt === null ? null : new Date(typeof body.publishedAt === "string" ? body.publishedAt : new Date());

  if (!title || !announcementBody || (publishedAt && Number.isNaN(publishedAt.getTime()))) {
    return NextResponse.json({ error: "Title and message content are required" }, { status: 400 });
  }

  try {
    const announcement = await prisma.announcement.create({
      data: { title, body: announcementBody, publishedAt, authorId: admin.userId },
      select: { id: true, title: true, body: true, publishedAt: true, createdAt: true, author: { select: { firstName: true, lastName: true } } },
    });
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: "Unable to save announcement" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create announcement" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: AnnouncementBody;
  try {
    body = (await request.json()) as AnnouncementBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const announcementBody = typeof body.body === "string" ? body.body.trim() : "";
  const publishedAt = body.publishedAt === null ? null : new Date(typeof body.publishedAt === "string" ? body.publishedAt : new Date());

  if (!id || !title || !announcementBody || (publishedAt && Number.isNaN(publishedAt.getTime()))) {
    return NextResponse.json({ error: "Announcement ID, title, and content are required" }, { status: 400 });
  }

  try {
    const announcement = await prisma.announcement.update({
      where: { id },
      data: { title, body: announcementBody, publishedAt },
      select: { id: true, title: true, body: true, publishedAt: true, createdAt: true, author: { select: { firstName: true, lastName: true } } },
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
