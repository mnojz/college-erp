import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/admin/person?kind=student|teacher&id=… — full detail payload for
 * the directory profile modal. Admin-only; privacy masking is bypassed by
 * design (this is an admin view, not a peer profile).
 *
 * Student: profile + program + user, last 50 attendance records (newest
 * first), published results, semester history (oldest first).
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
            take: 50,
            select: {
              id: true,
              status: true,
              session: {
                select: {
                  sessionDate: true,
                  class: {
                    select: {
                      dayOfWeek: true,
                      type: true,
                      subject: { select: { code: true, name: true } },
                    },
                  },
                },
              },
            },
          },
          results: {
            where: { assessment: { publishedAt: { not: null } } },
            orderBy: [
              { assessment: { assessmentDate: "desc" } },
              { assessment: { name: "asc" } },
            ],
            select: {
              id: true,
              marks: true,
              grade: true,
              assessment: {
                select: {
                  id: true,
                  name: true,
                  semester: true,
                  maxMarks: true,
                  assessmentDate: true,
                  subject: { select: { code: true, name: true } },
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
      return NextResponse.json({ kind, student });
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
    return NextResponse.json({ kind, teacher });
  } catch (error) {
    console.error("GET /api/admin/person error:", error);
    return NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}
