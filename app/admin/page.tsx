"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";

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
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  teachers: {
    label: "Faculty",
    description: "Teaching staff",
    iconBg: "rgba(124,58,237,0.12)",
    iconColor: "#7c3aed",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  programs: {
    label: "Programs",
    description: "Degree programs",
    iconBg: "rgba(16,185,129,0.12)",
    iconColor: "#059669",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  subjects: {
    label: "Subjects",
    description: "Course modules",
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "#d97706",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  classes: {
    label: "Class Slots",
    description: "Scheduled sessions",
    iconBg: "rgba(239,68,68,0.1)",
    iconColor: "#dc2626",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  assessments: {
    label: "Assessments",
    description: "Graded evaluations",
    iconBg: "rgba(14,165,233,0.12)",
    iconColor: "#0ea5e9",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
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
    title: "Programs",
    description: "Set up degree programs, departments, and academic structure.",
    cta: "Manage programs →",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    href: "/admin/teaching",
    iconBg: "rgba(245,158,11,0.12)",
    iconColor: "#d97706",
    title: "Subjects & Classes",
    description: "Define subjects, assign faculty, and configure weekly timetables.",
    cta: "Set up teaching →",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    href: "/admin/people",
    iconBg: "rgba(2,132,199,0.12)",
    iconColor: "#0284c7",
    title: "People",
    description: "Create and manage teacher and student accounts and identifiers.",
    cta: "Manage people →",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/admin/announcements",
    iconBg: "rgba(124,58,237,0.12)",
    iconColor: "#7c3aed",
    title: "Announcements",
    description: "Post notices, updates, and circulars for students and faculty.",
    cta: "Post notices →",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
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
            <strong>{action.cta}</strong>
          </a>
        ))}
      </section>
    </AdminShell>
  );
}
