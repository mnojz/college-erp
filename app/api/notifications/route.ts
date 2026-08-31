import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { parsePageParams, paginatedResponse } from "@/app/lib/pagination";

const ReadBodySchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

/** Latest notifications for the signed-in user + unread count. */
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip, limit } = parsePageParams(searchParams, { pageSize: 30 });

  try {
    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId: session.userId } }),
      prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
    ]);

    const { items, pagination } = paginatedResponse(notifications, total, page, pageSize);

    return NextResponse.json({ notifications: items, unread, pagination });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

/** Mark notifications as read — either a single id or everything unread. */
export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await jsonBody(request, ReadBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  try {
    if (body.all === true) {
      await prisma.notification.updateMany({
        where: { userId: session.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (body.id && body.id.trim()) {
      await prisma.notification.updateMany({
        where: { id: body.id.trim(), userId: session.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide a notification id or all:true" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/notifications/read error:", error);
    return NextResponse.json({ error: "Unable to mark notifications read" }, { status: 500 });
  }
}
