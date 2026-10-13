import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { jsonBody } from "@/app/lib/validation";
import { defaultMaxMarks, type ExamPart } from "@/app/lib/exams";
import { z } from "zod";

/** Decimal(6,2) column — keep client values inside the column's range. */
const MAX_MARKS_CEILING = 9999.99;

const CreateSessionSchema = z.object({
  programId: z.string().trim().min(1),
  semester: z.coerce.number().int().min(1).max(12),
  type: z.enum(["END_SEMESTER", "MID_TERM"]),
  title: z.string().trim().min(1).max(200),
  academicYearId: z.string().trim().min(1).optional().nullable(),
  // Optional explicit subject list; when omitted every subject in the
  // program + semester seeds one ExamSubject row per present part
  // (hasTheory → THEORY, hasPractical → PRACTICAL) with part-appropriate
  // default full marks. Explicit entries may override maxMarks per part.
  subjects: z
    .array(
      z.object({
        subjectId: z.string().trim().min(1),
        parts: z.array(z.enum(["THEORY", "PRACTICAL"])).min(1).optional(),
        maxMarks: z.coerce.number().gt(0).lte(MAX_MARKS_CEILING).optional(),
        theoryMaxMarks: z.coerce.number().gt(0).lte(MAX_MARKS_CEILING).optional(),
        practicalMaxMarks: z.coerce.number().gt(0).lte(MAX_MARKS_CEILING).optional(),
      }),
    )
    .optional(),
});

const SESSION_SELECT = {
  id: true,
  title: true,
  type: true,
  status: true,
  semester: true,
  routinePublishedAt: true,
  resultsPublishedAt: true,
  createdAt: true,
  academicYear: { select: { id: true, name: true } },
  program: { select: { id: true, name: true, code: true } },
  _count: { select: { subjects: true, routine: true } },
} as const;

/** GET /api/admin/exams — all exam sessions (admin only), newest first. */
export async function GET() {
  const session = await requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const exams = await prisma.examSession.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: SESSION_SELECT,
  });
  return NextResponse.json({ exams });
}

/**
 * POST /api/admin/exams — create an exam session for a cohort. Subjects are
 * seeded either from the explicit list or from the program + semester
 * curriculum. The unique constraint guarantees one session per
 * (program, semester, academic year, type).
 */
export async function POST(request: Request) {
  const session = await requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const parsed = await jsonBody(request, CreateSessionSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const program = await prisma.program.findUnique({
    where: { id: body.programId },
    select: { id: true, name: true },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  // Resolve which subject PARTS to include, expanding each subject's
  // hasTheory / hasPractical flags into one ExamSubject row per present part.
  let subjectRows: { subjectId: string; part: "THEORY" | "PRACTICAL"; maxMarks: number }[];
  if (body.subjects && body.subjects.length > 0) {
    const ids = body.subjects.map((s) => s.subjectId);
    const found = await prisma.subject.findMany({
      where: { id: { in: ids }, programId: body.programId, semester: body.semester },
      select: { id: true, hasTheory: true, hasPractical: true },
    });
    const flagsById = new Map(found.map((s) => [s.id, s]));
    subjectRows = [];
    for (const s of body.subjects) {
      const flags = flagsById.get(s.subjectId);
      if (!flags) continue;
      // Which parts does this entry want? Explicit `parts` win; otherwise
      // expand by the subject's TH/PR flags (legacy one-row entries included).
      const wanted: ExamPart[] = s.parts ?? [
        ...(flags.hasTheory ? (["THEORY"] as const) : []),
        ...(flags.hasPractical ? (["PRACTICAL"] as const) : []),
      ];
      for (const part of wanted) {
        const override =
          part === "THEORY" ? (s.theoryMaxMarks ?? s.maxMarks) : (s.practicalMaxMarks ?? s.maxMarks);
        subjectRows.push({
          subjectId: s.subjectId,
          part,
          maxMarks: override ?? defaultMaxMarks(part),
        });
      }
    }
    if (subjectRows.length === 0) {
      return NextResponse.json({ error: "No valid subjects for this program and semester" }, { status: 400 });
    }
  } else {
    const subjects = await prisma.subject.findMany({
      where: { programId: body.programId, semester: body.semester },
      select: { id: true, hasTheory: true, hasPractical: true },
      orderBy: { code: "asc" },
    });
    if (subjects.length === 0) {
      return NextResponse.json(
        { error: "This program + semester has no subjects yet" },
        { status: 400 },
      );
    }
    subjectRows = subjects.flatMap((s) => {
      const rows: typeof subjectRows = [];
      if (s.hasTheory) rows.push({ subjectId: s.id, part: "THEORY", maxMarks: defaultMaxMarks("THEORY") });
      if (s.hasPractical)
        rows.push({ subjectId: s.id, part: "PRACTICAL", maxMarks: defaultMaxMarks("PRACTICAL") });
      return rows;
    });
  }

  try {
    const created = await prisma.examSession.create({
      data: {
        programId: body.programId,
        semester: body.semester,
        type: body.type,
        title: body.title,
        academicYearId: body.academicYearId ?? null,
        subjects: {
          create: subjectRows.map((s) => ({
            subjectId: s.subjectId,
            part: s.part,
            maxMarks: s.maxMarks,
          })),
        },
      },
      select: SESSION_SELECT,
    });
    return NextResponse.json({ exam: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "An exam of this type already exists for this program, semester and year" },
        { status: 409 },
      );
    }
    console.error("POST /api/admin/exams error:", error);
    return NextResponse.json({ error: "Unable to create exam session" }, { status: 500 });
  }
}