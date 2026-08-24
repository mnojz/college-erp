import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession, requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type AnnouncementBody = {
  title?: unknown;
  body?: unknown;
  isPublic?: unknown;
  publishedAt?: unknown;
};

export async function GET() {
  const session = await getSession();
  const announcements = await prisma.announcement.findMany({
    where: session?.role === "ADMIN" ? undefined : { isPublic: true, publishedAt: { not: null, lte: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      isPublic: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { firstName: true, lastName: true } },
    },
  });
  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: AnnouncementBody;
  try {
    body = (await request.json()) as AnnouncementBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const announcementBody = typeof body.body === "string" ? body.body.trim() : "";
  const isPublic = body.isPublic === true;
  const publishedAt = body.publishedAt === null ? null : new Date(typeof body.publishedAt === "string" ? body.publishedAt : new Date());

  if (!title || !announcementBody || (publishedAt && Number.isNaN(publishedAt.getTime()))) {
    return NextResponse.json({ error: "Title, body, and a valid publish date are required" }, { status: 400 });
  }

  try {
    const announcement = await prisma.announcement.create({
      data: { title, body: announcementBody, isPublic, publishedAt, authorId: admin.userId },
      select: { id: true, title: true, body: true, isPublic: true, publishedAt: true, createdAt: true },
    });
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: "Unable to save announcement" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create announcement" }, { status: 500 });
  }
}
