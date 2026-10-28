import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { sessionGpa, buildRowForSubject, MarkRow } from "@/app/lib/grading";

/**
 * GET /api/admin/person?kind=student|teacher&id=… — full detail payload for
 * the directory profile modal. Admin-only; privacy masking is bypassed by
 * design (this is an admin view, not a peer profile).
 *
 * Student: profile + program + user, attendance records, marksheets, semester history.
 * Teacher: profile + subjects taught + classes + assessment/result counts.
 */
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "";
  const id = searchParams.get("id")?.trim() ?? "";
  if ((kind !== "student" && kind !== "teacher") || !id) {
    return NextResponse.json({ error: "kind=student|teacher and id are required" }, { status: 400 });
  }

  try {
    if (kind === "student") {
      const student = await prisma.student.findUnique({
        where: { id },
        select: {
          id: true,
          enrollmentNumber: true,
          registrationId: true,
          rollNumber: true,
          profileImageUrl: true,
          admissionDate: true,
          currentSemester: true,
          gender: true,
          nationality: true,
          religion: true,
          category: true,
          bloodGroup: true,
          phone: true,
          emergencyContact: true,
          guardianRelation: true,
          guardianPhone: true,
          guardianEmail: true,
          currProvinceName: true,
          currDistrictName: true,
          currLocalLevelName: true,
          currWard: true,
          currTole: true,
          currSameAsPerm: true,
          permProvinceName: true,
          permDistrictName: true,
          permLocalLevelName: true,
          permWard: true,
          permTole: true,
          status: true,
          createdAt: true,
          program: { select: { id: true, name: true, code: true, durationYears: true } },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              createdAt: true,
            },
          },
          attendanceRecords: {
            orderBy: { session: { sessionDate: "desc" } },
            take: 300,
            select: {
              id: true,
              status: true,
              note: true,
              session: {
                select: {
                  sessionDate: true,
                  class: {
                    select: {
                      dayOfWeek: true,
                      startTime: true,
                      endTime: true,
                      type: true,
                      subject: { select: { code: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          examMarks: {
            where: { examSubject: { session: { resultsPublishedAt: { not: null } } } },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              marks: true,
              grade: true,
              examSubject: {
                select: {
                  id: true,
                  maxMarks: true,
                  subject: { select: { code: true, name: true } },
                  session: { select: { title: true, semester: true } },
                },
              },
            },
          },
          studentSemesters: {
            orderBy: { semesterNo: "asc" },
            select: {
              id: true,
              semesterNo: true,
              status: true,
              startDate: true,
              endDate: true,
              academicYear: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      // Compute structured marksheets matching /student/results
      const examSessions = await prisma.examSession.findMany({
        where: {
          OR: [
            ...(student.program?.id ? [{ programId: student.program.id }] : []),
            { subjects: { some: { marks: { some: { studentId: student.id } } } } },
          ],
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

      const marksheets = examSessions
        .map((s) => {
          const codesWithPractical = new Set(
            s.subjects
              .filter((es) => es.part === "PRACTICAL")
              .map((es) => es.subject.code),
          );

          const rows: MarkRow[] = s.subjects
            .map((es) => {
              const mark = es.marks[0] ?? null;
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
        })
        .filter((m) => m.rows.length > 0 || (student.currentSemester !== null && m.semester === student.currentSemester));

      return NextResponse.json({
        kind,
        student: {
          ...student,
          marksheets,
        },
      });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNo: true,
        profileImageUrl: true,
        qualification: true,
        bio: true,
        office: true,
        phone: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
          },
        },
        subjectTeachers: {
          select: {
            id: true,
            subject: {
              select: {
                id: true,
                code: true,
                name: true,
                semester: true,
                program: { select: { code: true, name: true } },
              },
            },
          },
        },
        classes: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            semester: true,
            type: true,
            group: true,
            subject: { select: { code: true, name: true } },
            program: { select: { code: true, name: true } },
          },
        },
        _count: { select: { announcements: true, classes: true } },
      },
    });
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    return NextResponse.json({
      kind,
      teacher: {
        ...teacher,
        subjectIds: teacher.subjectTeachers.map((st) => st.subject.id),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/person error:", error);
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}
