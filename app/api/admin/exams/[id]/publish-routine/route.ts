import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { z } from "zod";
import { notifyUsers, studentUserIdsForSemester } from "@/app/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

const PublishRoutineSchema = z.object({
  registrationDeadline: z
    .string()
    .nullable()
    .optional()
    .refine((v) => (v === null || v === undefined) || !isNaN(new Date(v).getTime()), {
      message: "Invalid registration deadline",
    }),
});

/** Build a plain-text routine body for the auto-created announcement. */
function routineBody(
  title: string,
  programName: string,
  semester: number,
  entries: { date: Date; subject: { code: string; name: string } | null }[],
): string {
  const lines = [
    `${title}`,
    `${programName} — Semester ${semester}`,
    "",
    "Exam Routine:",
    ...entries.map((e, i) => {
      const date = e.date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      const subject = e.subject ? `${e.subject.code} — ${e.subject.name}` : "TBA";
      return `${i + 1}. ${date}: ${subject}`;
    }),
  ];
  return lines.join("\n");
}

/**
 * POST /api/admin/exams/[id]/publish-routine — announce the exam. Publishes the
 * routine, auto-creates a Program-scoped announcement carrying the routine, and
 * notifies every student in the cohort. Advances status DRAFT → ANNOUNCED.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireRole("ADMIN");
  if (!auth) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = await jsonBody(request, PublishRoutineSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

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

  // The admin must set a form submission deadline before the exam can be
  // announced: the deadline closes the registration window permanently once
  // reached (or once results are published), and the UI nudges the admin if it
  // is still unset. Legacy sessions (null deadline) stay open until results are
  // published, but the deadline is now a required field to announce a fresh one.
  if (body.registrationDeadline === null || body.registrationDeadline === undefined) {
    return NextResponse.json(
      { error: "Set the form submission deadline before announcing" },
      { status: 400 },
    );
  }

  const now = new Date();
  const deadline = new Date(body.registrationDeadline);
  if (isNaN(deadline.getTime())) {
    return NextResponse.json(
      { error: "Registration deadline is not a valid date" },
      { status: 400 },
    );
  }

  // Validate dates are in a sane range (not in the distant past).
  if (deadline.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Registration deadline must be in the future" },
      { status: 400 },
    );
  }

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