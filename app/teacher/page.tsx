"use client";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { formatTime } from "@/app/lib/timetable-layout";
import { campusDayOfWeek } from "@/app/lib/campus-time";
import { Badge } from "@/components/ui/badge";
import {
  IconArrowRight,
  IconBook,
  IconCalendarCheck,
  IconFileDescription,
  IconHierarchy2,
  IconReceipt,
  IconReportAnalytics,
  IconUser,
} from "@tabler/icons-react";

type TeacherData = {
  id: string;
  employeeNo: string;
  profileImageUrl: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  classes: Array<{
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    subject: { id: string; name: string; code: string };
    program: {
      id: string;
      name: string;
      code: string;
      departmentName: string;
      students: Array<{ id: string }>;
    };
    semester: number;
    _count: { sessions: number };
  }>;
};



export default function TeacherOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<TeacherData | null>(null);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/teacher/profile");
        if (response.status === 401 || response.status === 403) {
          router.replace("/dashboard");
          return;
        }
        const resJson = await response.json();
        if (!response.ok) {
          setError(resJson.error ?? "Failed to load teacher profile");
          return;
        }
        setData(resJson.teacher);
        setTotalAssessments(resJson.stats?.totalAssessments ?? 0);
      } catch {
        setError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  if (error) {
    return (
      <main className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-destructive">
        <p>{error}</p>
        <Button
          className="primary-button"
          type="button"
          onClick={() => router.replace("/dashboard")}
          style={{ marginTop: "16px" }}
        >
          Back to Login
        </Button>
      </main>
    );
  }

  if (loading || !data) {
    return <main className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">Loading faculty dashboard...</main>;
  }

  const fullName = `${data.user.firstName} ${data.user.lastName}`;

  // Deduplicate classes into unique subjects (subjects ≠ class slots — no time periods)
  const subjectMap = new Map<string, { code: string; name: string; program: string; semester: number; studentCount: number }>();
  for (const c of data.classes) {
    if (!subjectMap.has(c.subject.id)) {
      subjectMap.set(c.subject.id, {
        code: c.subject.code,
        name: c.subject.name,
        program: c.program.code,
        semester: c.semester,
        studentCount: c.program.students.length,
      });
    }
  }
  const uniqueSubjects = Array.from(subjectMap.values());
  const totalSubjects = uniqueSubjects.length;

  // Calculate unique students across all programs
  const studentIdSet = new Set<string>();
  let totalSessionsLogged = 0;
  for (const c of data.classes) {
    totalSessionsLogged += c._count.sessions;
    for (const s of c.program.students) {
      studentIdSet.add(s.id);
    }
  }
  const totalStudents = studentIdSet.size;

  // Primary department name
  const departmentName = data.classes[0]?.program.departmentName || "Engineering Faculty";

  // Today's schedule
  const todayDayName = campusDayOfWeek();
  const todaysClasses = data.classes.filter((c) => c.dayOfWeek === todayDayName);

  return (
    <TeacherShell
      active="/dashboard"
      title="Faculty Overview & Workspace"
      subtitle="Teacher Portal"
      teacherName={fullName}
      employeeNo={data.employeeNo}
      avatarUrl={data.profileImageUrl}
    >
      {/* Faculty Profile Hero Card */}
      <section className="mb-6 flex flex-wrap items-center gap-5 rounded-xl border bg-card p-6 shadow-xs">
        {data.profileImageUrl ? (
          <img
            src={data.profileImageUrl}
            alt={fullName}
            className="size-27.5 shrink-0 rounded-xl border-2 object-cover"
          />
        ) : (
          <div className="grid size-27.5 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary/85 to-primary text-4xl font-bold text-primary-foreground">
            {data.user.firstName[0]}
            {data.user.lastName[0]}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-2xl font-bold tracking-tight">{fullName}</h1>
            <Badge variant="secondary">Active</Badge>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1.5 [&_strong]:font-semibold [&_strong]:text-foreground">
            <span>
              <IconBook size={16} />
              {departmentName}
            </span>
            <span>
              <IconUser size={16} />
              Employee ID: <strong>{data.employeeNo}</strong>
            </span>
          </div>
          <p className="m-0 text-[13px] text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
            Institutional Email: <strong>{data.user.email}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild>
            <Link href="/teacher/attendance">
              <IconCalendarCheck size={16} />
              Take Attendance
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/assessments">
              <IconReportAnalytics size={16} />
              Manage Grades
            </Link>
          </Button>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teaching Subjects</span>
          <strong className="my-1 text-[34px] font-bold leading-none tracking-tight">{totalSubjects}</strong>
          <small className="text-xs text-muted-foreground">Unique subjects</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enrolled Students</span>
          <strong className="my-1 text-[34px] font-bold leading-none tracking-tight text-primary">{totalStudents}</strong>
          <small className="text-xs text-muted-foreground">Across assigned programs</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessments Held</span>
          <strong className="my-1 text-[34px] font-bold leading-none tracking-tight">{totalAssessments}</strong>
          <small className="text-xs text-muted-foreground">Quizzes, mid-terms &amp; finals</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance Sessions</span>
          <strong className="my-1 text-[34px] font-bold leading-none tracking-tight text-primary">{totalSessionsLogged}</strong>
          <small className="text-xs text-muted-foreground">Completed roll-call logs</small>
        </article>
      </section>

      {/* Read-only academic resources — the same pages the public site serves,
          so there is no separate teacher copy to keep in sync. */}
      <section className="mb-6">
        <h2 className="m-0 mb-3 text-lg font-bold">Academic Resources</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              href: "/teacher/resources?tab=syllabus",
              icon: IconFileDescription,
              title: "Syllabus Library",
              hint: "Official outlines by department & semester",
            },
            {
              href: "/teacher/resources?tab=structure",
              icon: IconHierarchy2,
              title: "Course Structure",
              hint: "Course map, credits & semesters",
            },
            {
              href: "/teacher/resources?tab=fees",
              icon: IconReceipt,
              title: "Fee Structure",
              hint: "Published programme & semester fees",
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-start gap-3 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-ring hover:bg-accent/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-primary">
                <card.icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <strong className="block text-sm font-semibold">{card.title}</strong>
                <small className="text-xs text-muted-foreground">{card.hint}</small>
              </span>
              <IconArrowRight
                size={16}
                aria-hidden="true"
                className="ml-auto shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Main Grid: Today's Schedule & Teaching Subjects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Teaching Subjects (unique, no time slots) */}
        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between border-b pb-3.5">
            <h2 className="m-0 text-lg font-bold">Teaching Subjects</h2>
            <span className="text-xs text-muted-foreground">{totalSubjects} unique</span>
          </div>

          {uniqueSubjects.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No teaching subjects assigned yet.</p>
          ) : (
            <div className="mt-4 grid gap-3.5">
              {uniqueSubjects.map((sub) => (
                <div key={sub.code} className="rounded-xl border bg-card p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline">{sub.code}</Badge>
                    <strong className="text-[0.95rem]">{sub.name}</strong>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.82rem] text-muted-foreground">
                    <span>Program: {sub.program}</span>
                    <span>•</span>
                    <span>Semester: {sub.semester}</span>
                    <span>•</span>
                    <span>{sub.studentCount} Students</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Today's Schedule Card */}
        <section className="rounded-xl border bg-card p-5 shadow-xs" style={{ padding: "24px" }}>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b pb-3.5">
            <h2 className="m-0 p-0 text-[1.1rem] font-bold">
              Today&apos;s Schedule ({todayDayName})
            </h2>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs font-semibold">
              <Link href="/teacher/schedule">
                <span className="inline-flex items-center gap-1">
                  Full Timetable <IconArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </Link>
            </Button>
          </div>

          {todaysClasses.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <p className="m-0">No lectures scheduled for today ({todayDayName}).</p>
              <small className="mt-2 block">Enjoy your lecture-free day or prepare assessments.</small>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {todaysClasses.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between rounded-[10px] border-l-4 border-l-primary bg-secondary p-3.5">
                  <div>
                    <strong className="block text-[0.92rem]">
                      {cls.subject.code} — {cls.subject.name}
                    </strong>
                    <span className="text-[0.8rem] text-muted-foreground">
                      {cls.program.code} · Semester {cls.semester}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-primary">
                      {formatTime(cls.startTime)}
                    </span>
                    <small className="block text-[0.75rem] text-muted-foreground">
                      to {formatTime(cls.endTime)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>
      </div>
    </TeacherShell>
  );
}

