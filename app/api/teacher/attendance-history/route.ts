import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireRole } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { parsePageParams, paginatedResponse } from "@/app/lib/pagination";
import { z } from "zod";

/**
 * GET /api/teacher/attendance-history — sessions + per-student summary for
 * the signed-in teacher's own classes.
 *
 * Query:
 *   ?programId=…&semester=…&subjectId=…&classId=…&studentId=…&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize=&q=
 *
 * - programId (optional): filter by program
 * - semester (optional): filter by semester number
 * - subjectId (optional): filter by subject
 * - classId (optional): filter by specific class
 * - studentId (optional): returns dedicated attendance log for a specific student
 * - from/to: date range filter (inclusive)
 * - q: text search on student name, enrollment, or roll number
 *
 * Returns { sessions, summary, programs, semesters, subjects, stats, pagination }
 */

const QuerySchema = z.object({
  programId: z.string().trim().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  subjectId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1).optional(),
  from: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid from date")
    .optional(),
  to: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid to date")
    .optional(),
  q: z.string().trim().min(1).optional(),
});

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const sessionSelect = {
  id: true,
  sessionDate: true,
  createdAt: true,
  class: {
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      semester: true,
      type: true,
      group: true,
      subject: { select: { id: true, code: true, name: true } },
      program: { select: { id: true, code: true, name: true } },
    },
  },
  records: {
    orderBy: [
      { student: { rollNumber: "asc" } },
      { student: { enrollmentNumber: "asc" } },
    ] as Prisma.AttendanceRecordOrderByWithRelationInput[],
    select: {
      id: true,
      status: true,
      studentId: true,
      note: true,
      student: {
        select: {
          id: true,
          enrollmentNumber: true,
          rollNumber: true,
          profileImageUrl: true,
          currentSemester: true,
          program: { select: { code: true, name: true } },
          user: { select: { firstName: true, lastName: true, status: true } },
        },
      },
    },
  },
} satisfies Prisma.AttendanceSessionSelect;

export async function GET(request: Request) {
  const session = await requireRole("TEACHER");
  if (!session) {
    return NextResponse.json({ error: "Teacher access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip, limit } = parsePageParams(searchParams, { pageSize: 20 });

  const rawQuery = Object.fromEntries(
    [...searchParams.entries()].filter(([, v]) => v !== ""),
  );
  const parsed = QuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  const f = parsed.data;

  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!teacher) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    }

    // All classes taught by this teacher.
    const owned = await prisma.class.findMany({
      where: {
        OR: [
          { teacherId: teacher.id },
          { subject: { subjectTeachers: { some: { teacherId: teacher.id } } } },
        ],
      },
      select: {
        id: true,
        subjectId: true,
        semester: true,
        programId: true,
        program: { select: { id: true, code: true, name: true } },
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            semester: true,
            program: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    // Extract distinct programs, semesters, and subjects available to this teacher
    const programMap = new Map<string, { id: string; code: string; name: string }>();
    const semesterSet = new Set<number>();
    const subjectMap = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        semester: number;
        programId: string;
        programCode: string;
        programName: string;
      }
    >();

    for (const c of owned) {
      if (!programMap.has(c.programId)) {
        programMap.set(c.programId, {
          id: c.program.id,
          code: c.program.code,
          name: c.program.name,
        });
      }
      semesterSet.add(c.semester);
      if (!subjectMap.has(c.subjectId)) {
        subjectMap.set(c.subjectId, {
          id: c.subject.id,
          code: c.subject.code,
          name: c.subject.name,
          semester: c.subject.semester,
          programId: c.programId,
          programCode: c.subject.program?.code ?? c.program.code,
          programName: c.subject.program?.name ?? c.program.name,
        });
      }
    }

    const programs = Array.from(programMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    const semesters = Array.from(semesterSet).sort((a, b) => a - b);
    const subjects = Array.from(subjectMap.values()).sort((a, b) => a.code.localeCompare(b.code));

    if (owned.length === 0) {
      const empty = paginatedResponse([], 0, page, pageSize);
      return NextResponse.json({
        sessions: empty.items,
        summary: [],
        programs: [],
        semesters: [],
        subjects: [],
        stats: {
          totalSessions: 0,
          classAverageRate: 0,
          atRiskCount: 0,
          totalStudents: 0,
        },
        pagination: empty.pagination,
      });
    }

    // Apply cascading filters: program -> semester -> subject -> class
    let filteredClasses = owned;

    if (f.programId && f.programId !== "ALL") {
      filteredClasses = filteredClasses.filter((c) => c.programId === f.programId);
    }
    if (f.semester) {
      filteredClasses = filteredClasses.filter((c) => c.semester === f.semester);
    }
    if (f.subjectId && f.subjectId !== "ALL") {
      filteredClasses = filteredClasses.filter((c) => c.subjectId === f.subjectId);
    }
    if (f.classId && f.classId !== "ALL") {
      filteredClasses = filteredClasses.filter((c) => c.id === f.classId);
    }

    const classIds = filteredClasses.map((c) => c.id);

    if (classIds.length === 0) {
      const empty = paginatedResponse([], 0, page, pageSize);
      return NextResponse.json({
        sessions: empty.items,
        summary: [],
        programs,
        semesters,
        subjects,
        stats: {
          totalSessions: 0,
          classAverageRate: 0,
          atRiskCount: 0,
          totalStudents: 0,
        },
        pagination: empty.pagination,
      });
    }

    const sessionWhere: Prisma.AttendanceSessionWhereInput = {
      classId: { in: classIds },
      ...(f.from || f.to
        ? {
            sessionDate: {
              ...(f.from ? { gte: parseDate(f.from) } : {}),
              ...(f.to ? { lte: parseDate(f.to) } : {}),
            },
          }
        : {}),
    };

    // If studentId is requested, return dedicated chronological history for this student
    if (f.studentId) {
      const student = await prisma.student.findUnique({
        where: { id: f.studentId },
        select: {
          id: true,
          enrollmentNumber: true,
          rollNumber: true,
          profileImageUrl: true,
          currentSemester: true,
          program: { select: { code: true, name: true } },
          user: { select: { firstName: true, lastName: true, status: true } },
        },
      });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      const allSessionsForStudent = await prisma.attendanceSession.findMany({
        where: sessionWhere,
        orderBy: { sessionDate: "desc" },
        select: {
          id: true,
          sessionDate: true,
          class: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              type: true,
              group: true,
              subject: { select: { code: true, name: true } },
            },
          },
          records: {
            where: { studentId: f.studentId },
            select: { id: true, status: true, note: true },
          },
        },
      });

      const history = allSessionsForStudent.map((s) => {
        const rec = s.records[0];
        return {
          sessionId: s.id,
          sessionDate: s.sessionDate,
          dayOfWeek: s.class.dayOfWeek,
          startTime: s.class.startTime,
          endTime: s.class.endTime,
          type: s.class.type,
          group: s.class.group,
          subjectCode: s.class.subject.code,
          subjectName: s.class.subject.name,
          status: rec ? rec.status : "ABSENT",
          note: rec?.note ?? null,
        };
      });

      const presentSessions = history.filter((h) => h.status === "PRESENT").length;
      const totalSessions = history.length;
      const percentage =
        totalSessions > 0
          ? Number(((presentSessions / totalSessions) * 100).toFixed(1))
          : 0;

      return NextResponse.json({
        student: {
          id: student.id,
          enrollmentNumber: student.enrollmentNumber,
          rollNumber: student.rollNumber,
          profileImageUrl: student.profileImageUrl,
          programCode: student.program?.code ?? "",
          programName: student.program?.name ?? "",
          semester: student.currentSemester ?? 0,
          name: `${student.user.firstName} ${student.user.lastName}`,
          accountStatus: student.user.status,
        },
        history,
        stats: {
          totalSessions,
          presentSessions,
          absentSessions: totalSessions - presentSessions,
          percentage,
        },
      });
    }

    const [pageSessions, total, allRecords] = await Promise.all([
      prisma.attendanceSession.findMany({
        where: sessionWhere,
        orderBy: { sessionDate: "desc" },
        skip,
        take: limit,
        select: sessionSelect,
      }),
      prisma.attendanceSession.count({ where: sessionWhere }),
      // Full record set behind the filter — drives the per-student summary
      // so percentages don't shift while paging through sessions.
      prisma.attendanceRecord.findMany({
        where: { session: sessionWhere },
        select: {
          status: true,
          studentId: true,
          student: {
            select: {
              id: true,
              enrollmentNumber: true,
              rollNumber: true,
              profileImageUrl: true,
              currentSemester: true,
              program: { select: { code: true, name: true } },
              user: { select: { firstName: true, lastName: true, status: true } },
            },
          },
        },
      }),
    ]);

    // Gather active enrolled students for the active filtered classes
    const activeProgramIds = Array.from(new Set(filteredClasses.map((c) => c.programId)));
    const activeSemesters = Array.from(new Set(filteredClasses.map((c) => c.semester)));

    const enrolledStudents = await prisma.student.findMany({
      where: {
        programId: { in: activeProgramIds },
        currentSemester: { in: activeSemesters },
        status: "ACTIVE",
      },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        profileImageUrl: true,
        currentSemester: true,
        program: { select: { code: true, name: true } },
        user: { select: { firstName: true, lastName: true, status: true } },
      },
    });

    // Per-student totals across ALL filtered sessions.
    const byStudent = new Map<
      string,
      {
        studentId: string;
        enrollmentNumber: string;
        rollNumber: number | null;
        profileImageUrl: string | null;
        programCode: string;
        programName: string;
        semester: number;
        firstName: string;
        lastName: string;
        accountStatus: string;
        present: number;
        total: number;
      }
    >();

    // Pre-populate with enrolled students so anyone with zero sessions is also visible
    for (const s of enrolledStudents) {
      byStudent.set(s.id, {
        studentId: s.id,
        enrollmentNumber: s.enrollmentNumber,
        rollNumber: s.rollNumber,
        profileImageUrl: s.profileImageUrl,
        programCode: s.program?.code ?? "",
        programName: s.program?.name ?? "",
        semester: s.currentSemester ?? 0,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        accountStatus: s.user.status,
        present: 0,
        total: 0,
      });
    }

    // Tally records
    for (const r of allRecords) {
      let entry = byStudent.get(r.studentId);
      if (!entry) {
        entry = {
          studentId: r.studentId,
          enrollmentNumber: r.student.enrollmentNumber,
          rollNumber: r.student.rollNumber,
          profileImageUrl: r.student.profileImageUrl,
          programCode: r.student.program?.code ?? "",
          programName: r.student.program?.name ?? "",
          semester: r.student.currentSemester ?? 0,
          firstName: r.student.user.firstName,
          lastName: r.student.user.lastName,
          accountStatus: r.student.user.status,
          present: 0,
          total: 0,
        };
        byStudent.set(r.studentId, entry);
      }
      entry.total += 1;
      if (r.status === "PRESENT") entry.present += 1;
    }

    const q = f.q?.toLowerCase() ?? "";
    const qIsNum = q !== "" && /^\d+$/.test(q);
    let summary = [...byStudent.values()].map((s) => ({
      ...s,
      percentage: s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 0,
    }));

    if (q) {
      summary = summary.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          s.enrollmentNumber.toLowerCase().includes(q) ||
          (qIsNum && s.rollNumber === Number(q)),
      );
    }
    summary.sort((a, b) => (a.rollNumber ?? 9999) - (b.rollNumber ?? 9999));

    const totalSessions = total;
    const classAverageRate =
      summary.length > 0
        ? Number(
            (
              summary.reduce((acc, s) => acc + s.percentage, 0) / summary.length
            ).toFixed(1),
          )
        : 0;
    const atRiskCount = summary.filter((s) => s.total > 0 && s.percentage < 75).length;

    const stats = {
      totalSessions,
      classAverageRate,
      atRiskCount,
      totalStudents: summary.length,
    };

    const { items, pagination } = paginatedResponse(pageSessions, total, page, pageSize);

    return NextResponse.json({
      sessions: items,
      summary,
      programs,
      semesters,
      subjects,
      stats,
      pagination,
    });
  } catch (error) {
    console.error("GET /api/teacher/attendance-history error:", error);
    return NextResponse.json({ error: "Unable to load attendance history" }, { status: 500 });
  }
}
