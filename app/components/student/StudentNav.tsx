"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { AssetIcon, studentAssets } from "./assets";

type StudentNavProps = { name: string; studentId: string; avatarUrl?: string | null };

function getTheme() {
  if (typeof window === "undefined") return "light" as const;
  const savedTheme = window.localStorage.getItem("college-erp-theme");
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" as const : "light" as const;
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("college-erp-theme-change", onChange);
  return () => window.removeEventListener("college-erp-theme-change", onChange);
}

export function StudentNav({ name, studentId, avatarUrl }: StudentNavProps) {
  const router = useRouter();
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
    <header className="student-nav">
      <div className="student-brand">
        <span className="home-brand-icon" style={{ width: 36, height: 36 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
            <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
          </svg>
        </span>
        <div className="home-brand-text">
          <strong>College-ERP</strong>
          <small>Student Portal</small>
        </div>
      </div>
      <div className="student-nav-actions">
        <div className="theme-switch" aria-label="Theme options">
          <button className={theme === "light" ? "selected" : ""} type="button" onClick={() => changeTheme("light")} aria-label="Use light theme"><AssetIcon src={studentAssets.sun} size={14} /></button>
          <button className={theme === "dark" ? "selected" : ""} type="button" onClick={() => changeTheme("dark")} aria-label="Use dark theme"><AssetIcon src={studentAssets.moon} size={14} /></button>
        </div>
        <button className="notification-button" type="button" aria-label="Notifications"><AssetIcon src={studentAssets.bell} size={20} /><b>3</b></button>
        <button className="student-user-trigger" type="button" onClick={logout} title="Sign out">
          <span><strong>{name}</strong><small>Student ID: {studentId}</small></span>
          <img src={avatarUrl || studentAssets.avatar} alt="" width={32} height={32} />
        </button>
      </div>
    </header>
  );
}
