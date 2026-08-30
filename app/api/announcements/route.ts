import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  allAdminUserIds,
  allStudentUserIds,
  allTeacherUserIds,
  notifyUsers,
  studentUserIdsForSemester,
} from "@/app/lib/notify";

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
  // Teacher-scoped fields (required for TEACHER-created notices).
  subjectId: string | null;
  programId: string | null;
  semester: number | null;
};

const ANNOUNCEMENT_SELECT = {
  id: true,
  title: true,
  body: true,
  publishedAt: true,
  createdAt: true,
  authorId: true,
  teacherId: true,
  semester: true,
  author: { select: { firstName: true, lastName: true } },
  subject: { select: { id: true, name: true, code: true } },
  program: { select: { id: true, name: true, code: true } },
  attachmentFileName: true,
  attachmentMimeType: true,
  attachmentSize: true,
} as const;

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
      const semesterRaw = form.get("semester");
      const publishedAt =
        publishedRaw === null || publishedRaw === "" ? null : new Date(String(publishedRaw));
      const subjectId = form.get("subjectId");
      const programId = form.get("programId");
      return {
        id: typeof id === "string" && id.trim() ? id.trim() : null,
        title: typeof title === "string" ? title.trim() : "",
        body: typeof body === "string" ? body.trim() : "",
        publishedAt,
        publishedAtInvalid: publishedAt !== null && Number.isNaN(publishedAt.getTime()),
        file: file instanceof File && file.size > 0 ? file : null,
        removeAttachment: removeRaw === "1" || removeRaw === "true",
        subjectId: typeof subjectId === "string" && subjectId.trim() ? subjectId.trim() : null,
        programId: typeof programId === "string" && programId.trim() ? programId.trim() : null,
        semester:
          semesterRaw === null || semesterRaw === "" ? null : Number.parseInt(String(semesterRaw), 10),
      };
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const publishedRaw = raw.publishedAt;
    const publishedAt =
      publishedRaw === null || publishedRaw === undefined || publishedRaw === ""
        ? null
        : new Date(String(publishedRaw));
    const semesterRaw = raw.semester;
    return {
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : null,
      title: typeof raw.title === "string" ? raw.title.trim() : "",
      body: typeof raw.body === "string" ? raw.body.trim() : "",
      publishedAt,
      publishedAtInvalid: publishedAt !== null && Number.isNaN(publishedAt.getTime()),
      file: null,
      removeAttachment: raw.removeAttachment === true,
      subjectId: typeof raw.subjectId === "string" && raw.subjectId.trim() ? raw.subjectId.trim() : null,
      programId: typeof raw.programId === "string" && raw.programId.trim() ? raw.programId.trim() : null,
      semester:
        typeof semesterRaw === "number" && Number.isFinite(semesterRaw) && semesterRaw >= 1
          ? semesterRaw
          : typeof semesterRaw === "string" && semesterRaw.trim() !== ""
            ? Number.parseInt(semesterRaw, 10)
            : null,
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

/** True when a teacher (by Teacher.id) actually teaches that subject×program×semester group. */
async function teachesGroup(
  teacherId: string,
  subjectId: string,
  programId: string,
  semester: number,
): Promise<boolean> {
  const match = await prisma.class.findFirst({
    where: { teacherId, subjectId, programId, semester },
    select: { id: true },
  });
  return Boolean(match);
}

/**
 * GET /api/announcements
 * Role-aware listing:
 *  - anonymous: published campus-wide bulletins (no teacher scope)
 *  - ADMIN:     everything (drafts + teacher-scoped)
 *  - TEACHER:   campus bulletins + their own notices
 *  - STUDENT:   campus bulletins + teacher notices for their program+semester
 *  - `?mine=1`: (auth only) rows authored by the signed-in user
 */
export async function GET(request: Request) {
  const session = await getSession();
  const mine = new URL(request.url).searchParams.get("mine") === "1";

  try {
    let where: Prisma.AnnouncementWhereInput;
    if (mine) {
      if (!session) return NextResponse.json({ announcements: [] });
      where = { authorId: session.userId };
    } else if (session?.role === "ADMIN") {
      where = {};
    } else if (session?.role === "TEACHER") {
      where = {
        OR: [{ teacherId: null, publishedAt: { not: null, lte: new Date() } }, { authorId: session.userId }],
      };
    } else if (session?.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.userId },
        select: { programId: true, currentSemester: true },
      });
      where =
        student?.programId != null && student.currentSemester != null
          ? {
              publishedAt: { not: null, lte: new Date() },
              OR: [{ teacherId: null }, { programId: student.programId, semester: student.currentSemester }],
            }
          : { teacherId: null, publishedAt: { not: null, lte: new Date() } };
    } else {
      where = { teacherId: null, publishedAt: { not: null, lte: new Date() } };
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: ANNOUNCEMENT_SELECT,
    });
    return NextResponse.json({ announcements });
  } catch (error) {
    console.error("GET /api/announcements error:", error);
    return NextResponse.json({ error: "Unable to load announcements" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN" && session.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    if (session.role === "TEACHER") {
      // Teacher notices must target a teaching group they are assigned to.
      const subjectId = input.subjectId;
      const programId = input.programId;
      const semester = input.semester;
      if (!subjectId || !programId || semester == null) {
        return NextResponse.json(
          { error: "Select the subject, program, and semester you want to notify" },
          { status: 400 },
        );
      }
      const teacher = await prisma.teacher.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (!teacher) {
        return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
      }
      const teaches = await teachesGroup(teacher.id, subjectId, programId, semester);
      if (!teaches) {
        return NextResponse.json({ error: "You can only notify classes you teach" }, { status: 403 });
      }

      const announcement = await prisma.announcement.create({
        data: {
          title,
          body: announcementBody,
          publishedAt: new Date(), // teacher notices go live immediately
          authorId: session.userId,
          teacherId: teacher.id,
          subjectId,
          programId,
          semester,
          ...attachmentWrite,
        },
        select: ANNOUNCEMENT_SELECT,
      });

      // Notify every student of the targeted class group.
      const [subjectInfo, studentIds] = await Promise.all([
        prisma.subject.findUnique({ where: { id: subjectId }, select: { code: true, name: true } }),
        studentUserIdsForSemester(programId, semester),
      ]);
      await notifyUsers(
        studentIds,
        {
          type: "notice",
          title: `New notice in ${subjectInfo?.code ?? "your subject"} — ${subjectInfo?.name ?? ""}`.replace(/ — $/, ""),
          body: title,
          link: "/dashboard",
        },
        { excludeUserId: session.userId },
      );

      return NextResponse.json({ announcement }, { status: 201 });
    }

    const announcement = await prisma.announcement.create({
      data: { title, body: announcementBody, publishedAt, authorId: session.userId, ...attachmentWrite },
      select: ANNOUNCEMENT_SELECT,
    });

    // Campus-wide bulletin → every student, teacher, and (other) admin,
    // each pointed at the page in their own portal.
    const [studentIds, teacherIds, adminIds] = await Promise.all([
      allStudentUserIds(),
      allTeacherUserIds(),
      allAdminUserIds(),
    ]);
    const payload = {
      type: "announcement",
      title: "New campus announcement",
      body: title,
    } as const;
    await notifyUsers(studentIds, { ...payload, link: "/dashboard" }, { excludeUserId: session.userId });
    await notifyUsers(teacherIds, { ...payload, link: "/teacher/announcements" }, { excludeUserId: session.userId });
    await notifyUsers(adminIds, { ...payload, link: "/admin/announcements" }, { excludeUserId: session.userId });

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
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "TEACHER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const attachmentWrite = input.file
      ? await attachmentWriteFor(input.file)
      : input.removeAttachment
        ? ATTACHMENT_CLEAR
        : {};

    if (session.role === "TEACHER") {
      // Teachers may only edit their own announcements and must keep the scope
      // pointing at a group they actually teach.
      const teacher = await prisma.teacher.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (!teacher || existing.teacherId !== teacher.id) {
        return NextResponse.json({ error: "You can only edit your own announcements" }, { status: 403 });
      }
      const subjectId = input.subjectId;
      const programId = input.programId;
      const semester = input.semester;
      if (!subjectId || !programId || semester == null) {
        return NextResponse.json(
          { error: "Select the subject, program, and semester you want to notify" },
          { status: 400 },
        );
      }
      const teaches = await teachesGroup(teacher.id, subjectId, programId, semester);
      if (!teaches) {
        return NextResponse.json({ error: "You can only notify classes you teach" }, { status: 403 });
      }

      const announcement = await prisma.announcement.update({
        where: { id },
        data: {
          title,
          body: announcementBody,
          subjectId,
          programId,
          semester,
          ...attachmentWrite,
        },
        select: ANNOUNCEMENT_SELECT,
      });
      return NextResponse.json({ announcement }, { status: 200 });
    }

    // Admin edits: if no new scope is supplied (the admin form is campus-wide),
    // preserve whatever scope currently exists on the notice.
    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        title,
        body: announcementBody,
        publishedAt,
        ...(input.subjectId && input.programId && input.semester != null
          ? { subjectId: input.subjectId, programId: input.programId, semester: input.semester }
          : {}),
        ...attachmentWrite,
      },
      select: ANNOUNCEMENT_SELECT,
    });
    return NextResponse.json({ announcement }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/announcements error:", error);
    return NextResponse.json({ error: "Unable to update announcement" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "ADMIN" && session.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, teacherId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    if (session.role === "TEACHER") {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (!teacher || existing.teacherId !== teacher.id) {
        return NextResponse.json({ error: "You can only delete your own announcements" }, { status: 403 });
      }
    }

    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/announcements error:", error);
    return NextResponse.json({ error: "Unable to delete announcement" }, { status: 500 });
  }
}