"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AssetIcon, studentAssets } from "@/app/components/student/assets";

type TeacherShellProps = {
  title: string;
  subtitle: string;
  teacherName?: string;
  employeeNo?: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
};

const navItems = [
  { label: "Overview", href: "/teacher", icon: studentAssets.academic },
  { label: "Class Attendance", href: "/teacher/attendance", icon: studentAssets.attendance },
  { label: "Assessments & Grading", href: "/teacher/assessments", icon: studentAssets.result },
  { label: "Teaching Schedule", href: "/teacher/schedule", icon: studentAssets.schedules },
] as const;

function getTheme() {
  if (typeof window === "undefined") return "light" as const;
  const saved = window.localStorage.getItem("college-erp-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" as const : "light" as const;
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("college-erp-theme-change", onChange);
  return () => window.removeEventListener("college-erp-theme-change", onChange);
}

export function TeacherShell({
  title,
  subtitle,
  teacherName = "Faculty Member",
  employeeNo = "FACULTY",
  avatarUrl,
  children,
}: TeacherShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, () => "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function changeTheme(nextTheme: "light" | "dark") {
    window.localStorage.setItem("college-erp-theme", nextTheme);
    window.dispatchEvent(new Event("college-erp-theme-change"));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <div className="student-app-shell">
      <header className="student-nav">
        <div className="student-brand">
          <span className="student-brand-mark" style={{ background: "#0ea5e9" }}>
            <AssetIcon src={studentAssets.graduationCap} size={22} />
          </span>
          <span>
            <strong>College-ERP</strong>
            <small>FWU-Faculty</small>
          </span>
        </div>
        <div className="student-nav-actions">
          <div className="theme-switch" aria-label="Theme options">
            <button
              className={theme === "light" ? "selected" : ""}
              type="button"
              onClick={() => changeTheme("light")}
              aria-label="Use light theme"
            >
              <AssetIcon src={studentAssets.sun} size={14} />
            </button>
            <button
              className={theme === "dark" ? "selected" : ""}
              type="button"
              onClick={() => changeTheme("dark")}
              aria-label="Use dark theme"
            >
              <AssetIcon src={studentAssets.moon} size={14} />
            </button>
          </div>
          <button className="notification-button" type="button" aria-label="Notifications">
            <AssetIcon src={studentAssets.bell} size={20} />
            <b>2</b>
          </button>
          <button
            className="student-user-trigger"
            type="button"
            onClick={logout}
            title="Sign out from Faculty Workspace"
          >
            <span>
              <strong>{teacherName}</strong>
              <small>Emp ID: {employeeNo}</small>
            </span>
            <img src={avatarUrl || studentAssets.avatar} alt="" width={32} height={32} />
          </button>
        </div>
      </header>

      <div className="student-page-body">
        <aside className="student-sidebar">
          <nav aria-label="Teacher navigation">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  className={`student-sidebar-link ${isActive ? "active" : ""}`}
                  href={item.href}
                >
                  <AssetIcon src={item.icon} size={20} />
                  <span>{item.label}</span>
                  {isActive && <i />}
                </Link>
              );
            })}
          </nav>
          <div className="student-support">
            <strong>Faculty Support</strong>
            <p>Need assistance with attendance records, grades, or timetable?</p>
            <a href="mailto:helpdesk@college.edu">Contact IT Helpdesk</a>
          </div>
        </aside>

        <main className="student-profile-content">
          <header className="admin-page-heading" style={{ marginBottom: "24px" }}>
            <p>{subtitle}</p>
            <h1>{title}</h1>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

