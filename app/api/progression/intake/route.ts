import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  parseBulkRow,
  requireCurrentAcademicYear,
  validateBulkIntake,
  type BulkStudentInput,
} from "@/app/lib/progression";

const IntakeBodySchema = z.object({
  programId: z.string().trim().min(1),
  semester: z.coerce.number().int().min(1),
  admissionDate: z.string().trim().min(1).optional(),
  password: z.string().min(8).max(72).optional(),
  dryRun: z.boolean().optional(),
  rows: z.array(z.unknown()).min(1).max(500),
});

/**
 * POST /api/progression/intake — bulk-admit a new batch from an uploaded JSON
 * file (entrance-system export).
 *
 * Two-phase by design: the client first sends dryRun:true and renders the
 * preview table (or the problem list); only after Confirm does it re-send
 * with dryRun:false. The server re-validates on commit, so a file edited
 * between preview and confirm can't slip through.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = IntakeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "programId, semester and rows[] are required" }, { status: 400 });
  }
  const body = parsed.data;

  const rows: BulkStudentInput[] = [];
  const shapeProblems: string[] = [];
  body.rows.forEach((v, i) => {
    const row = parseBulkRow(v);
    if (!row) shapeProblems.push(`Row ${i + 1}: not a student object`);
    else rows.push(row);
  });
  if (shapeProblems.length > 0) {
    return NextResponse.json({ ok: false, problems: shapeProblems }, { status: 422 });
  }

  try {
    const checked = await validateBulkIntake(prisma, body.programId, body.semester, rows);
    if (!checked.ok) {
      return NextResponse.json({ ok: false, problems: checked.problems }, { status: 422 });
    }
    if (body.dryRun !== false) {
      // Preview: echo normalized rows plus the program/semester context. The
      // client renders this as the confirmation table.
      const program = await prisma.program.findUnique({
        where: { id: body.programId },
        select: { code: true, name: true },
      });
      return NextResponse.json({
        ok: true,
        preview: {
          programCode: program?.code ?? "",
          programName: program?.name ?? "",
          semester: body.semester,
          count: checked.rows.length,
          students: checked.rows,
        },
      });
    }

    // Commit: re-validated above, so this transaction either admits the whole
    // batch or nothing.
    const year = await requireCurrentAcademicYear(prisma);
    const admissionDate = body.admissionDate ? new Date(body.admissionDate) : new Date();
    if (Number.isNaN(admissionDate.getTime())) {
      return NextResponse.json({ error: "admissionDate is not a valid date" }, { status: 400 });
    }
    const passwordHash = await hash(body.password ?? "student1234", 12);
    const now = new Date();

    const created = await prisma.$transaction(async (tx) => {
      const out: Array<{ enrollmentNumber: string; email: string }> = [];
      for (const r of checked.rows) {
        const user = await tx.user.create({
          data: {
            email: r.email.toLowerCase(),
            passwordHash,
            firstName: r.firstName,
            lastName: r.lastName,
            role: "STUDENT",
          },
          select: { id: true, email: true },
        });
        const student = await tx.student.create({
          data: {
            userId: user.id,
            enrollmentNumber: r.enrollmentNumber,
            registrationId: r.registrationId,
            rollNumber: r.rollNumber,
            admissionDate,
            programId: body.programId,
            currentSemester: body.semester,
            status: "ACTIVE",
          },
          select: { id: true, enrollmentNumber: true },
        });
        await tx.studentSemester.create({
          data: {
            studentId: student.id,
            academicYearId: year.id,
            semesterNo: body.semester,
            status: "ACTIVE",
            startDate: now,
          },
        });
        out.push({ enrollmentNumber: student.enrollmentNumber, email: user.email });
      }
      return out;
    });

    return NextResponse.json(
      {
        ok: true,
        created: created.length,
        academicYear: year.name,
        students: created,
      },
      { status: 201 },
    );
  } catch (error) {
    const e = error as { code?: string; message?: string };
    if (e?.code === "P2002") {
      return NextResponse.json(
        { ok: false, problems: ["A record collided on save (duplicate unique field) — nothing was created"] },
        { status: 409 },
      );
    }
    const msg = e?.message ?? "";
    if (msg.startsWith("NO_CURRENT_YEAR:")) {
      return NextResponse.json(
        { ok: false, problems: ["No current academic year is set — create one before admitting students"] },
        { status: 400 },
      );
    }
    console.error("POST /api/progression/intake error:", error);
    return NextResponse.json({ ok: false, problems: ["Unable to admit batch"] }, { status: 500 });
  }
}
