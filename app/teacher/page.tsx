"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import {
  IconArrowRight,
  IconBook,
  IconCalendarCheck,
  IconClipboardCheck,
  IconReportAnalytics,
  IconTarget,
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

const daysOfWeek = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

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
          router.replace("/");
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
      <main className="profile-error">
        <p>{error}</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => router.replace("/")}
          style={{ marginTop: "16px" }}
        >
          Back to Login
        </button>
      </main>
    );
  }

  if (loading || !data) {
    return <main className="profile-loading">Loading faculty dashboard...</main>;
  }

  const fullName = `${data.user.firstName} ${data.user.lastName}`;
  const totalClasses = data.classes.length;

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
  const todayDayName = daysOfWeek[new Date().getDay()];
  const todaysClasses = data.classes.filter((c) => c.dayOfWeek === todayDayName);

  return (
    <TeacherShell
      active="/teacher"
      title="Faculty Overview & Workspace"
      subtitle="Teacher Portal"
      teacherName={fullName}
      employeeNo={data.employeeNo}
      avatarUrl={data.profileImageUrl}
    >
      {/* Faculty Profile Hero Card */}
      <section className="profile-hero" style={{ marginBottom: "24px" }}>
        {data.profileImageUrl ? (
          <img
            src={data.profileImageUrl}
            alt={fullName}
            className="profile-hero-image"
            style={{
              width: "110px",
              height: "110px",
              borderRadius: "12px",
              objectFit: "cover",
              border: "2px solid var(--line, #e2e8f0)",
            }}
          />
        ) : (
          <div
            className="profile-hero-image"
            style={{
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)",
              color: "#fff",
              fontSize: "36px",
              fontWeight: "700",
            }}
          >
            {data.user.firstName[0]}
            {data.user.lastName[0]}
          </div>
        )}
        <div className="profile-hero-details">
          <div className="profile-name-row">
            <h1>{fullName}</h1>
            <span className="active-badge">
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                }}
              />
              Active Faculty
            </span>
          </div>
          <div className="profile-meta-row">
            <span>
              <IconBook size={16} />
              {departmentName}
            </span>
            <span>
              <IconUser size={16} />
              Employee ID: <strong>{data.employeeNo}</strong>
            </span>
          </div>
          <p>
            Institutional Email: <strong>{data.user.email}</strong>
          </p>
        </div>
        <div className="profile-hero-actions">
          <Link
            href="/teacher/attendance"
            className="profile-edit-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            <IconCalendarCheck size={16} />
            Take Attendance
          </Link>
          <Link
            href="/teacher/assessments"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: "8px",
              background: "var(--panel, #fff)",
              color: "inherit",
              fontSize: "12px",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            <IconReportAnalytics size={16} />
            Manage Grades
          </Link>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
        <article className="admin-metric-card">
          <span>Assigned Classes</span>
          <strong>{totalClasses}</strong>
          <small>Active subject sections</small>
        </article>
        <article className="admin-metric-card">
          <span>Enrolled Students</span>
          <strong style={{ color: "#0ea5e9" }}>{totalStudents}</strong>
          <small>Across assigned programs</small>
        </article>
        <article className="admin-metric-card">
          <span>Assessments Held</span>
          <strong style={{ color: "#8b5cf6" }}>{totalAssessments}</strong>
          <small>Quizzes, mid-terms &amp; finals</small>
        </article>
        <article className="admin-metric-card">
          <span>Attendance Sessions</span>
          <strong style={{ color: "#10b981" }}>{totalSessionsLogged}</strong>
          <small>Completed roll-call logs</small>
        </article>
      </section>

      {/* Main Grid: Today's Schedule & Assigned Subjects */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
        {/* Assigned Classes */}
        <section className="profile-info-card" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
            }}
          >
            <h2 style={{ margin: 0, padding: 0, fontSize: "1.1rem", fontWeight: "700" }}>
              My Assigned Classes
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft, #64748b)" }}>
              {totalClasses} Classes
            </span>
          </div>

          {data.classes.length === 0 ? (
            <p className="empty-state" style={{ textAlign: "center", padding: "30px 0" }}>
              No teaching classes assigned yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "14px", marginTop: "16px" }}>
              {data.classes.map((cls) => (
                <div
                  key={cls.id}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid var(--line, #e2e8f0)",
                    background: "var(--panel, #fff)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "#e0f2fe",
                          color: "#0284c7",
                          fontSize: "0.75rem",
                          fontWeight: "700",
                        }}
                      >
                        {cls.subject.code}
                      </span>
                      <strong style={{ fontSize: "0.95rem" }}>{cls.subject.name}</strong>
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--ink-soft, #64748b)", display: "flex", gap: "12px" }}>
                      <span>Program: {cls.program.code}</span>
                      <span>•</span>
                      <span>Semester: {cls.semester}</span>
                      <span>•</span>
                      <span>{cls.program.students.length} Students</span>
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "0.78rem", color: "var(--ink-soft, #64748b)" }}>
                      ⏰ {cls.dayOfWeek} · {new Date(cls.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(cls.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <Link
                      href="/teacher/attendance"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "#0ea5e9",
                        color: "#fff",
                        fontSize: "0.78rem",
                        fontWeight: "600",
                        textAlign: "center",
                        textDecoration: "none",
                      }}
                    >
                      Roll Call
                    </Link>
                    <Link
                      href="/teacher/assessments"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid var(--line, #e2e8f0)",
                        background: "transparent",
                        color: "inherit",
                        fontSize: "0.78rem",
                        fontWeight: "600",
                        textAlign: "center",
                        textDecoration: "none",
                      }}
                    >
                      Assessments
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Today's Schedule Card */}
        <section className="profile-info-card" style={{ padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
            }}
          >
            <h2 style={{ margin: 0, padding: 0, fontSize: "1.1rem", fontWeight: "700" }}>
              Today&apos;s Schedule ({todayDayName})
            </h2>
            <Link
              href="/teacher/schedule"
              style={{ fontSize: "0.8rem", color: "#0ea5e9", fontWeight: "600", textDecoration: "none" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                Full Timetable <IconArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
              </span>
            </Link>
          </div>

          {todaysClasses.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-soft, #64748b)" }}>
              <p style={{ margin: 0 }}>No lectures scheduled for today ({todayDayName}).</p>
              <small style={{ display: "block", marginTop: "8px" }}>Enjoy your lecture-free day or prepare assessments.</small>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
              {todaysClasses.map((cls) => (
                <div
                  key={cls.id}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    borderLeft: "4px solid #0ea5e9",
                    background: "rgba(14, 165, 233, 0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: "0.92rem" }}>
                      {cls.subject.code} — {cls.subject.name}
                    </strong>
                    <span style={{ fontSize: "0.8rem", color: "var(--ink-soft, #64748b)" }}>
                      {cls.program.code} · Semester {cls.semester}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "#0ea5e9" }}>
                      {new Date(cls.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <small style={{ display: "block", color: "var(--ink-soft, #64748b)", fontSize: "0.75rem" }}>
                      to {new Date(cls.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Shortcuts */}
          <div
            style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--line, #e2e8f0)",
            }}
          >
            <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "10px" }}>
              Quick Navigation
            </strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <Link
                href="/teacher/attendance"
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: "var(--panel, #fff)",
                  border: "1px solid var(--line, #e2e8f0)",
                  color: "inherit",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                <IconClipboardCheck size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-2px" }} />
                Take Attendance
              </Link>
              <Link
                href="/teacher/assessments"
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: "var(--panel, #fff)",
                  border: "1px solid var(--line, #e2e8f0)",
                  color: "inherit",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                <IconTarget size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-2px" }} />
                Enter Marks
              </Link>
            </div>
          </div>
        </section>
      </div>
    </TeacherShell>
  );
}

