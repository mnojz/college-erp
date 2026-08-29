import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/** Latest notifications for the signed-in user + unread count. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
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
      prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
    ]);

    return NextResponse.json({ notifications, unread });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 });
  }
}

/** Mark notifications as read — either a single id or everything unread. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: unknown; all?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; all?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    if (body.all === true) {
      await prisma.notification.updateMany({
        where: { userId: session.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (typeof body.id === "string" && body.id.trim()) {
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
