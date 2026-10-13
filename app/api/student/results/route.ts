import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sessionGpa } from "@/app/lib/grading";
import { GRADE_VALUE, buildRowForSubject } from "@/app/lib/grading";

/** One subject row of the results sheet: TH/PR split grades, credits, and totals. */
export type MarkRow = {
  /** Combined subject name shown in the row; Th+Pr together */
  subjectName: string;
  /** Credits offered for this subject (split across Th and Pr) */
  totalCredits: number;
  /** Grade for the theory part (TH) */
  thGrade: string | null;
  /** Grade for the practical part (PR) */
  prGrade: string | null;
  /** ExamSubject kind: THEORY or PRACTICAL */
  kind: "THEORY" | "PRACTICAL";
  /** Passed status: false when grade is F */
  passed: boolean;
  /** Combined grade (used for the Final column) */
  finalGrade: string;
  /** Grading scale used by the UI (A+=4.0, A=3.6, A-=3.2, B+=2.8, B=2.4, B-=2.0, C=1.6, C-=1.2, D=0.8, F=0.0) */
  gradeValue: number;
  /** Credit hours earned (only for passed subjects) */
  creditPoints: number;
};

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
  student: { name: string; program: { name: string; code: string } | null; semester: number | null };
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
        user: { select: { firstName: true, lastName: true } },
        program: { select: { name: true, code: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }
    if (!student.programId || student.currentSemester === null) {
      return NextResponse.json({
        student: {
          name: `${student.user.firstName} ${student.user.lastName}`.trim(),
          program: student.program,
          semester: student.currentSemester,
        },
        marksheet: [],
        latestGpa: null,
      });
    }

    const sessions = await prisma.examSession.findMany({
      where: {
        programId: student.programId,
        semester: student.currentSemester,
        resultsPublishedAt: { not: null },
      },
      orderBy: { resultsPublishedAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        semester: true,
        resultsPublishedAt: true,
        program: { select: { name: true, code: true } },
        subjects: {
          orderBy: [{ part: "asc" }, { subject: { code: "asc" } }],
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

    const marksheet = sessions.map((s) => {
      const rows = s.subjects
        .map((es) => {
          const mark = es.marks[0] ?? null;
          return {
            subject: {
              code: es.subject.code,
              name: es.subject.name,
              credits: es.subject.credits,
              kind: es.part as "THEORY" | "PRACTICAL",
            },
            mark,
            maxMarks: Number(es.maxMarks),
            marks: mark ? Number(mark.marks) : null,
          };
        })
        .filter((row) => row.marks !== null)
        .map((row) => buildRowForSubject(row));
      return {
        id: s.id,
        title: s.title,
        type: s.type,
        semester: s.semester,
        resultsPublishedAt: s.resultsPublishedAt,
        program: s.program,
        rows,
        gpa: sessionGpa(rows.map((r) => r.gradeValue)),
      };
    });

    const latestGpa = marksheet.find((m) => m.gpa !== null)?.gpa ?? null;

    return NextResponse.json({
      student: {
        name: `${student.user.firstName} ${student.user.lastName}`.trim(),
        program: student.program,
        semester: student.currentSemester,
      },
      marksheet,
      latestGpa,
    });
  } catch (error) {
    console.error("GET /api/student/results error:", error);
    return NextResponse.json({ error: "Unable to load results" }, { status: 500 });
  }
}