"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import {
  ProgramDistributionChart,
  SemesterEnrollmentChart,
  StudentLifecycleDonutCard,
  WeeklyTeachingLoadCard,
  type BarDatum,
  type LifecycleData,
  type WeeklyDayDatum,
} from "@/app/components/admin/Charts";
import {
  IconAlertCircle,
  IconArrowRight,
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconSchool,
  IconTrendingUp,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Totals = {
  students: number;
  teachers: number;
  programs: number;
  subjects: number;
  classes: number;
  assessments: number;
  pendingReviews: number;
  attendanceRate: number;
  totalAttendance: number;
};

type Stats = {
  totals: Totals;
  byProgram: Array<{ programId: string; code: string; name: string; count: number }>;
  bySemester: Array<{ semester: number; count: number }>;
  lifecycle: LifecycleData;
  weeklyLoad: WeeklyDayDatum[];
  examStats: { draft: number; announced: number; published: number };
};

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) return router.replace("/dashboard");
        const user = await me.json();
        if (user.user.role !== "ADMIN") return router.replace("/dashboard");

        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed to load statistics");
        const data = await res.json();
        setStats(data);
      } catch {
        setError("Unable to load campus statistics at this time.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const programData: BarDatum[] = (stats?.byProgram ?? []).map((p) => ({
    label: `${p.code} · ${p.name}`,
    value: p.count,
    secondary: p.code,
  }));

  const semesterData: BarDatum[] = (stats?.bySemester ?? []).map((s) => ({
    label: `Sem ${s.semester}`,
    value: s.count,
  }));

  return (
    <AdminShell
      title="Overview"
      subtitle="Institutional performance, enrollment density, and academic schedule analytics"
      active="/dashboard"
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div
            className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            role="alert"
          >
            <IconAlertCircle className="size-5 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Action-Required: Pending Profile Reviews */}
        {stats && stats.totals.pendingReviews > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <IconUserCheck size={20} />
              </span>
              <div>
                <p className="text-sm font-bold">
                  {stats.totals.pendingReviews} Student Profile Change Request
                  {stats.totals.pendingReviews > 1 ? "s" : ""} Pending Review
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Learners have submitted profile update requests that require administrative verification.
                </p>
              </div>
            </div>
            <Link href="/admin/profile-reviews">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-500/40 bg-card text-foreground hover:bg-amber-500/10 font-medium shrink-0"
              >
                <span>Verify Requests</span>
                <IconArrowRight size={14} />
              </Button>
            </Link>
          </div>
        )}

        {/* Vital KPI Metric Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-card p-3 sm:p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))
          ) : (
            <>
              {/* 1. Students */}
              <Link href="/admin/people" className="group">
                <Card className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      Students
                    </span>
                    <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <IconUsers size={17} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums leading-none">
                      {stats?.totals.students ?? 0}
                    </p>
                  </div>
                </Card>
              </Link>

              {/* 2. Teachers */}
              <Link href="/admin/people" className="group">
                <Card className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-xs transition-all duration-200 hover:border-emerald-500/40 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      Teachers
                    </span>
                    <span className="flex size-7.5 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <IconSchool size={17} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums leading-none">
                      {stats?.totals.teachers ?? 0}
                    </p>
                  </div>
                </Card>
              </Link>

              {/* 3. Programs */}
              <Link href="/admin/curriculum" className="group">
                <Card className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-xs transition-all duration-200 hover:border-violet-500/40 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      Programs
                    </span>
                    <span className="flex size-7.5 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      <IconBriefcase size={17} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums leading-none">
                      {stats?.totals.programs ?? 0}
                    </p>
                  </div>
                </Card>
              </Link>

              {/* 4. Course Subjects */}
              <Link href="/admin/curriculum" className="group">
                <Card className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-xs transition-all duration-200 hover:border-blue-500/40 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      Subjects
                    </span>
                    <span className="flex size-7.5 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <IconBook size={17} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums leading-none">
                      {stats?.totals.subjects ?? 0}
                    </p>
                  </div>
                </Card>
              </Link>

              {/* 5. Class Slots */}
              <Link href="/admin/teaching" className="group">
                <Card className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-xs transition-all duration-200 hover:border-amber-500/40 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                      Class Slots
                    </span>
                    <span className="flex size-7.5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <IconCalendar size={17} />
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums leading-none">
                      {stats?.totals.classes ?? 0}
                    </p>
                  </div>
                </Card>
              </Link>

              {/* 6. Attendance Rate */}
              <Card className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Attendance Avg
                  </span>
                  <span className="flex size-7.5 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <IconTrendingUp size={17} />
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums leading-none">
                    {stats?.totals.attendanceRate ?? 0}%
                  </p>
                </div>
              </Card>
            </>
          )}
        </section>

        {/* Primary Academic Visualizations: Program Distribution & Semester Density */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? (
            <>
              <Skeleton className="h-72 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </>
          ) : (
            <>
              <ProgramDistributionChart
                title="Enrollment by Degree Program"
                data={programData}
                totalStudents={stats?.totals.students}
              />
              <SemesterEnrollmentChart
                title="Students per Semester (Undergraduate)"
                data={semesterData}
              />
            </>
          )}
        </section>

        {/* Secondary Academic Visualizations: Retention Lifecycle & Weekly Schedule Load */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? (
            <>
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </>
          ) : (
            <>
              <StudentLifecycleDonutCard
                data={stats?.lifecycle ?? { active: 0, graduated: 0, dropped: 0 }}
              />
              <WeeklyTeachingLoadCard data={stats?.weeklyLoad ?? []} />
            </>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
