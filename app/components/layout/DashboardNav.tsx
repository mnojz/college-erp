"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { IconBell } from "@tabler/icons-react";

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
        {/* Theme Switcher — single toggle */}
        <ThemeToggle />

        {/* Notifications (if count > 0) */}
        {notificationCount > 0 && (
          <button className="notification-button" type="button" aria-label="Notifications" title={`${notificationCount} new alerts`}>
            <IconBell size={20} aria-hidden="true" />
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

