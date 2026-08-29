"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import {
  IconArrowRight,
  IconBell,
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconChecklist,
  IconPlus,
  IconSchool,
  IconUsers,
} from "@tabler/icons-react";

type Counts = Record<
  "students" | "teachers" | "programs" | "subjects" | "classes" | "assessments",
  number
>;

const initial: Counts = {
  students: 0,
  teachers: 0,
  programs: 0,
  subjects: 0,
  classes: 0,
  assessments: 0,
};

type MetricConfig = {
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
};

const METRIC_CONFIG: Record<keyof Counts, MetricConfig> = {
  students: {
    label: "Students",
    description: "Enrolled learners",
    iconBg: "rgba(2,132,199,0.12)",
    iconColor: "#0284c7",
    icon: <IconUsers size={20} />,
  },
  teachers: {
    label: "Faculty",
    description: "Teaching staff",
    iconBg: "rgba(124,58,237,0.12)",
    iconColor: "#7c3aed",
    icon: <IconSchool size={20} />,
  },
  programs: {
    label: "Programs",
    description: "Degree programs",
    iconBg: "rgba(16,185,129,0.12)",
    iconColor: "#059669",
    icon: <IconBriefcase size={20} />,
  },
  subjects: {
    label: "Subjects",
    description: "Course modules",
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "#d97706",
    icon: <IconBook size={20} />,
  },
  classes: {
    label: "Class Slots",
    description: "Scheduled sessions",
    iconBg: "rgba(239,68,68,0.1)",
    iconColor: "#dc2626",
    icon: <IconCalendar size={20} />,
  },
  assessments: {
    label: "Assessments",
    description: "Graded evaluations",
    iconBg: "rgba(14,165,233,0.12)",
    iconColor: "#0ea5e9",
    icon: <IconChecklist size={20} />,
  },
};

type ActionConfig = {
  href: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
};

const ACTIONS: ActionConfig[] = [
  {
    href: "/admin/setup",
    iconBg: "rgba(16,185,129,0.12)",
    iconColor: "#059669",
    title: "Departments & Programs",
    description: "Set up departments, degree programs, and the academic structure.",
    cta: "Manage structure",
    icon: <IconBriefcase size={22} />,
  },
  {
    href: "/admin/teaching",
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "#d97706",
    title: "Subjects & Classes",
    description: "Define subjects, assign faculty, and configure weekly timetables.",
    cta: "Set up teaching",
    icon: <IconBook size={22} />,
  },
  {
    href: "/admin/people",
    iconBg: "rgba(2,132,199,0.12)",
    iconColor: "#0284c7",
    title: "People",
    description: "Create and manage teacher and student accounts and identifiers.",
    cta: "Manage people",
    icon: <IconUsers size={22} />,
  },
  {
    href: "/admin/announcements",
    iconBg: "rgba(124,58,237,0.12)",
    iconColor: "#7c3aed",
    title: "Announcements",
    description: "Post notices, updates, and circulars for students and faculty.",
    cta: "Post notices",
    icon: <IconBell size={22} />,
  },
];

export default function AdminPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok) return router.replace("/");
      const user = await me.json();
      if (user.user.role !== "ADMIN") return router.replace("/");

      const endpoints = ["students", "teachers", "programs", "subjects", "classes", "assessments"];
      const responses = await Promise.all(endpoints.map((ep) => fetch(`/api/${ep}`)));
      if (responses.some((r) => !r.ok)) throw new Error();
      const data = await Promise.all(responses.map((r) => r.json()));

      setCounts({
        students: data[0].students.length,
        teachers: data[1].teachers.length,
        programs: data[2].programs.length,
        subjects: data[3].subjects.length,
        classes: data[4].classes.length,
        assessments: data[5].assessments.length,
      });
    }

    load().catch(() => setError("Unable to load dashboard data"));
  }, [router]);

  return (
    <AdminShell title="College Overview" subtitle="Administration" active="/admin">
      {/* Hero Banner */}
      <section className="admin-welcome">
        <div>
          <span className="active-badge">Active workspace</span>
          <h2>Academic records at a glance</h2>
          <p>
            Build the program structure, assign faculty to classes, and keep student
            records organized — all from one place.
          </p>
        </div>
        <a href="/admin/setup">
          <IconPlus size={16} strokeWidth={2.5} aria-hidden="true" />
          Create Program
        </a>
      </section>

      {/* Error */}
      {error && (
        <p className="admin-message error" role="alert">
          {error}
        </p>
      )}

      {/* Metric Cards */}
      <section className="admin-metric-grid">
        {(Object.entries(counts) as [keyof Counts, number][]).map(([key, value]) => {
          const cfg = METRIC_CONFIG[key];
          return (
            <article key={key} className="admin-metric-card">
              <div
                className="metric-icon"
                style={{ background: cfg.iconBg, color: cfg.iconColor }}
              >
                {cfg.icon}
              </div>
              <span>{cfg.label}</span>
              <strong>{value}</strong>
              <small>{cfg.description}</small>
            </article>
          );
        })}
      </section>

      {/* Quick Action Cards */}
      <section className="admin-action-grid">
        {ACTIONS.map((action) => (
          <a key={action.href} href={action.href}>
            <div
              className="action-icon"
              style={{ background: action.iconBg, color: action.iconColor }}
            >
              {action.icon}
            </div>
            <h3>{action.title}</h3>
            <p>{action.description}</p>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              {action.cta}
              <IconArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
            </strong>
          </a>
        ))}
      </section>
    </AdminShell>
  );
}
