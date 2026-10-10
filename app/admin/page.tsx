"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import {
  BarChartCard,
  ColumnChartCard,
  LifecycleDonutCard,
  type BarDatum,
  type LifecycleData,
} from "@/app/components/admin/Charts";
import {
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconChecklist,
  IconSchool,
  IconUsers,
} from "@tabler/icons-react";

type Totals = {
  students: number;
  teachers: number;
  programs: number;
  subjects: number;
  classes: number;
  assessments: number;
};

type Stats = {
  totals: Totals;
  byProgram: Array<{ code: string; name: string; count: number }>;
  bySemester: Array<{ semester: number; count: number }>;
  lifecycle: LifecycleData;
};

const METRIC_CONFIG: Record<
  keyof Totals,
  { label: string; description: string; icon: React.ReactNode }
> = {
  students: { label: "Students", description: "Enrolled learners", icon: <IconUsers size={20} /> },
  teachers: { label: "Teachers", description: "Teaching staff", icon: <IconSchool size={20} /> },
  programs: { label: "Programs", description: "Degree programs", icon: <IconBriefcase size={20} /> },
  subjects: { label: "Subjects", description: "Course modules", icon: <IconBook size={20} /> },
  classes: { label: "Class Slots", description: "Scheduled sessions", icon: <IconCalendar size={20} /> },
  assessments: {
    label: "Assessments",
    description: "Graded evaluations",
    icon: <IconChecklist size={20} />,
  },
};

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok) return router.replace("/dashboard");
      const user = await me.json();
      if (user.user.role !== "ADMIN") return router.replace("/dashboard");

      // One aggregate request — the previous six list-fetch + `.length` approach
      // undercounted students (the endpoint paginates at 25).
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      setStats(await res.json());
    }

    load().catch(() => setError("Unable to load dashboard data"));
  }, [router]);

  const programData: BarDatum[] = (stats?.byProgram ?? []).map((p) => ({
    label: `${p.code} · ${p.name}`,
    value: p.count,
  }));
  const semesterData: BarDatum[] = (stats?.bySemester ?? []).map((s) => ({
    label: `Sem ${s.semester}`,
    value: s.count,
  }));

  return (
    <AdminShell title="Overview" subtitle="College statistics at a glance" active="/dashboard">
      {error && (
        <p
          className="mt-3.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Stat Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(METRIC_CONFIG) as Array<keyof Totals>).map((key) => {
          const cfg = METRIC_CONFIG[key];
          const value = stats?.totals[key] ?? 0;
          return (
            <article
              key={key}
              className="flex min-w-0 items-center gap-4 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/30"
            >
              <div
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary [&_svg]:size-5"
              >
                {cfg.icon}
              </div>
              <div className="min-w-0">
                <p className="m-0 text-sm font-medium text-muted-foreground">{cfg.label}</p>
                <p className="m-0 mt-0.5 truncate text-2xl font-bold leading-tight tracking-tight text-foreground">
                  {value}
                </p>
                <p className="m-0 text-xs text-muted-foreground/80">{cfg.description}</p>
              </div>
            </article>
          );
        })}
      </section>

      {/* Distribution charts */}
      <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChartCard title="Enrollment by program" data={programData} />
        <ColumnChartCard title="Students per semester" data={semesterData} />
        <div className="lg:col-span-2">
          <LifecycleDonutCard
            data={stats?.lifecycle ?? { active: 0, graduated: 0, dropped: 0 }}
          />
        </div>
      </section>
    </AdminShell>
  );
}

