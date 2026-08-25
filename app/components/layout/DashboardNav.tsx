"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { AssetIcon, studentAssets } from "@/app/components/student/assets";

export type DashboardNavProps = {
  brandTitle?: string;
  brandSubtitle?: string;
  brandHomeHref?: string;
  brandIconBg?: string;
  userName?: string;
  userSubtitle?: string;
  avatarUrl?: string | null;
  notificationCount?: number;
  onLogout?: () => void;
};

function getTheme() {
  if (typeof window === "undefined") return "light" as const;
  const saved = window.localStorage.getItem("college-erp-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? ("dark" as const) : ("light" as const);
}

function subscribe(onChange: () => void) {
  window.addEventListener("college-erp-theme-change", onChange);
  return () => window.removeEventListener("college-erp-theme-change", onChange);
}

export function DashboardNav({
  brandTitle = "College-ERP",
  brandSubtitle = "Academic Terminal",
  brandHomeHref = "/",
  brandIconBg = "#0284c7",
  userName = "User",
  userSubtitle = "Sign out",
  avatarUrl,
  notificationCount = 0,
  onLogout,
}: DashboardNavProps) {
  const router = useRouter();
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function changeTheme(nextTheme: "light" | "dark") {
    window.localStorage.setItem("college-erp-theme", nextTheme);
    window.dispatchEvent(new Event("college-erp-theme-change"));
  }

  async function handleLogout() {
    if (onLogout) {
      onLogout();
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const initials = userName
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "US";

  return (
    <header className="student-nav">
      <Link href={brandHomeHref} className="home-nav-brand">
        <span
          className="home-brand-icon"
          style={{ width: 38, height: 38, borderRadius: "10px", background: brandIconBg }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
            <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
          </svg>
        </span>
        <div className="home-brand-text">
          <strong>{brandTitle}</strong>
          <small>{brandSubtitle}</small>
        </div>
      </Link>

      <div className="student-nav-actions">
        {/* Theme Switcher */}
        <div className="theme-switch" aria-label="Theme options">
          <button
            className={theme === "light" ? "selected" : ""}
            type="button"
            onClick={() => changeTheme("light")}
            aria-label="Use light theme"
            title="Switch to Light Theme"
          >
            <AssetIcon src={studentAssets.sun} size={14} />
          </button>
          <button
            className={theme === "dark" ? "selected" : ""}
            type="button"
            onClick={() => changeTheme("dark")}
            aria-label="Use dark theme"
            title="Switch to Dark Theme"
          >
            <AssetIcon src={studentAssets.moon} size={14} />
          </button>
        </div>

        {/* Notifications (if count > 0) */}
        {notificationCount > 0 && (
          <button className="notification-button" type="button" aria-label="Notifications" title={`${notificationCount} new alerts`}>
            <AssetIcon src={studentAssets.bell} size={20} />
            <b>{notificationCount}</b>
          </button>
        )}

        {/* User Account & Signout */}
        <button
          className="student-user-trigger"
          type="button"
          onClick={handleLogout}
          title="Sign out of your account"
        >
          <span>
            <strong>{userName}</strong>
            <small>{userSubtitle}</small>
          </span>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={34}
              height={34}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <span className="nav-avatar-fallback" style={{ background: brandIconBg }}>
              {initials}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

