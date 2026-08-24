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
    router.replace("/login");
  }

  return (
    <header className="student-nav">
      <div className="student-brand">
        <span className="student-brand-mark"><AssetIcon src={studentAssets.graduationCap} size={22} /></span>
        <span><strong>College-ERP</strong><small>FWU-Engineering</small></span>
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
