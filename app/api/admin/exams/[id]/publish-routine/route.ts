import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { notifyUsers, studentUserIdsForSemester } from "@/app/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

/** Build a formatted markdown routine table body for the auto-created announcement. */
function routineBody(
  title: string,
  programName: string,
  semester: number,
  entries: { date: Date; subject: { code: string; name: string } | null }[],
): string {
  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const tableRows = sorted.map((e) => {
    const weekday = e.date.toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    });
    const date = e.date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    const subject = e.subject ? `${e.subject.code} — ${e.subject.name}` : "TBA";
    return `| ${weekday} | ${date} | ${subject} |`;
  });

  const lines = [
    `${title}`,
    `${programName} — Semester ${semester}`,
    "",
    "The official examination schedule has been published for all registered candidates:",
    "",
    "| Day | Date | Subject |",
    "| :--- | :--- | :--- |",
    ...tableRows,
    "",
    "Please check your reporting time and bring your valid Admit Card and College ID to the examination hall.",
  ];
  return lines.join("\n");
}

/**
 * POST /api/admin/exams/[id]/publish-routine — announce the exam. Publishes the
 * routine, auto-creates a Program-scoped announcement carrying the routine, and
 * notifies every student in the cohort. Advances status DRAFT → ANNOUNCED.
 */
export async function POST(_request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const session = await prisma.examSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      semester: true,
      programId: true,
      program: { select: { name: true } },
      subjects: { select: { subjectId: true } },
      registrationDeadline: true,
      routine: {
        orderBy: { order: "asc" },
        select: { date: true, subject: { select: { code: true, name: true } } },
      },
    },
  });
  if (!session) return NextResponse.json({ error: "Exam session not found" }, { status: 404 });
  if (session.routine.length === 0) {
    return NextResponse.json(
      { error: "Build the routine before announcing the exam" },
      { status: 400 },
    );
  }

  // The form submission deadline is set when the exam is created. It must be
  // present to announce: it closes the registration window once reached (or
  // once results are published). Legacy sessions created before this field
  // existed cannot be announced until a deadline is set via the edit API.
  if (!session.registrationDeadline) {
    return NextResponse.json(
      { error: "Set the form submission deadline before announcing (set at exam creation)" },
      { status: 400 },
    );
  }
  const deadline = new Date(session.registrationDeadline);
  if (isNaN(deadline.getTime())) {
    return NextResponse.json(
      { error: "Stored registration deadline is not a valid date" },
      { status: 400 },
    );
  }
  const now = new Date();

  const bodyText = routineBody(session.title, session.program.name, session.semester, session.routine);

  // Auto-create a program-scoped announcement carrying the routine.
  const announcement = await prisma.announcement.create({
    data: {
      title: `Exam Routine: ${session.title}`,
      body: bodyText,
      publishedAt: now,
      authorId: auth.userId,
      programId: session.programId,
      semester: session.semester,
    },
    select: { id: true },
  });

  // Persist the registration deadline on the session.
  await prisma.examSession.update({
    where: { id },
    data: {
      status: session.status === "DRAFT" ? "ANNOUNCED" : session.status,
      routinePublishedAt: now,
      routinePublishedBy: auth.userId,
      registrationDeadline: deadline,
    },
  });

  // Notify the cohort.
  try {
    const userIds = await studentUserIdsForSemester(session.programId, session.semester);
    await notifyUsers(
      userIds,
      {
        type: "exam",
        title: `Exam announced: ${session.title}`,
        body: `The exam routine for ${session.program.name} Semester ${session.semester} has been published. Registrations close on ${deadline.toLocaleDateString("en-GB")}. Check your notices for the schedule.`,
        link: "/dashboard",
      },
      { excludeUserId: auth.userId },
    );
  } catch (notifyError) {
    console.error("exam routine notification error:", notifyError);
  }

  return NextResponse.json({ success: true, announcementId: announcement.id });
}