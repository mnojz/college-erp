import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sessionGpa, buildRowForSubject, MarkRow } from "@/app/lib/grading";

export type { MarkRow };

type Marksheet = {
  id: string;
  title: string;
  type: "END_SEMESTER" | "MID_TERM";
  semester: number;
  resultsPublishedAt: string;
  program: { name: string; code: string };
  rows: MarkRow[];
  gpa: number | null;
};

type Payload = {
  student: {
    name: string;
    registrationId: string | null;
    program: { name: string; code: string; durationYears?: number } | null;
    semester: number | null;
  };
  marksheet: Marksheet[];
  latestGpa: number | null;
};

export async function GET() {
  const session = await requireRole("STUDENT");
  if (!session) {
    return NextResponse.json({ error: "Student access required" }, { status: 403 });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        programId: true,
        currentSemester: true,
        registrationId: true,
        user: { select: { firstName: true, lastName: true } },
        program: { select: { name: true, code: true, durationYears: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }
    if (!student.programId || student.currentSemester === null) {
      return NextResponse.json({
        student: {
          name: `${student.user.firstName} ${student.user.lastName}`.trim(),
          registrationId: student.registrationId,
          program: student.program,
          semester: student.currentSemester,
        },
        marksheet: [],
        latestGpa: null,
      } satisfies Payload);
    }

    const sessions = await prisma.examSession.findMany({
      where: {
        programId: student.programId,
        resultsPublishedAt: { not: null },
      },
      orderBy: [{ semester: "asc" }, { resultsPublishedAt: "desc" }],
      select: {
        id: true,
        title: true,
        type: true,
        semester: true,
        resultsPublishedAt: true,
        program: { select: { name: true, code: true } },
        subjects: {
          orderBy: [{ subject: { code: "asc" } }, { part: "asc" }],
          select: {
            id: true,
            part: true,
            maxMarks: true,
            subject: { select: { code: true, name: true, credits: true } },
            marks: { where: { studentId: student.id } },
          },
        },
      },
    });

    const marksheet: Marksheet[] = sessions.map((s) => {
      // Determine which subject codes have a PRACTICAL counterpart in this session.
      const codesWithPractical = new Set(
        s.subjects
          .filter((es) => es.part === "PRACTICAL")
          .map((es) => es.subject.code),
      );

      const rows: MarkRow[] = s.subjects
        .map((es) => {
          const mark = es.marks[0] ?? null;
          // Skip subjects where the student has no mark at all.
          if (!mark) return null;
          return buildRowForSubject({
            subject: {
              code: es.subject.code,
              name: es.subject.name,
              credits: es.subject.credits,
              kind: es.part as "THEORY" | "PRACTICAL",
              hasPractical: codesWithPractical.has(es.subject.code),
            },
            mark: { grade: mark.grade },
          });
        })
        .filter((r): r is MarkRow => r !== null);

      return {
        id: s.id,
        title: s.title,
        type: s.type,
        semester: s.semester,
        resultsPublishedAt: s.resultsPublishedAt as unknown as string,
        program: s.program,
        rows,
        gpa: sessionGpa(rows.map((r) => r.gradeValue)),
      };
    }).filter((m) => m.rows.length > 0 || m.semester === student.currentSemester);

    const latestGpa = marksheet.find((m) => m.gpa !== null)?.gpa ?? null;

    return NextResponse.json({
      student: {
        name: `${student.user.firstName} ${student.user.lastName}`.trim(),
        registrationId: student.registrationId,
        program: student.program,
        semester: student.currentSemester,
      },
      marksheet,
      latestGpa,
    } satisfies Payload);
  } catch (error) {
    console.error("GET /api/student/results error:", error);
    return NextResponse.json({ error: "Unable to load results" }, { status: 500 });
  }
}