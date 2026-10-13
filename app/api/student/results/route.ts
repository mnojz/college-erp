import { NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sessionGpa } from "@/app/lib/grading";

/**
 * GET /api/student/results — the signed-in student's PUBLISHED exam results, as
 * a marksheet grouped by exam session. Only sessions with results published are
 * returned; each carries per-subject marks/grade/gradePoint plus the session
 * GPA (mean of subject grade points, F = 0.0). Newest session first.
 */
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
            subject: es.subject,
            maxMarks: Number(es.maxMarks),
            marks: mark ? Number(mark.marks) : null,
            grade: mark?.grade ?? null,
            gradePoint:
              mark?.gradePoint === null || mark?.gradePoint === undefined
                ? null
                : Number(mark.gradePoint),
          };
        })
        .filter((row) => row.marks !== null);
      return {
        id: s.id,
        title: s.title,
        type: s.type,
        semester: s.semester,
        resultsPublishedAt: s.resultsPublishedAt,
        program: s.program,
        rows,
        gpa: sessionGpa(rows.map((r) => r.gradePoint)),
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