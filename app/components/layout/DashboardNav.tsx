"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconSchool } from "@tabler/icons-react";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { NotificationDropdown } from "@/app/components/common/NotificationDropdown";

export type DashboardNavProps = {
  brandTitle?: string;
  brandSubtitle?: string;
  brandHomeHref?: string;
  brandIconBg?: string;
  userName?: string;
    userSubtitle?: string;
  avatarUrl?: string | null;
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
          <IconSchool size={22} />
        </span>
        <div className="home-brand-text">
          <strong>{brandTitle}</strong>
          <small>{brandSubtitle}</small>
        </div>
      </Link>

      <div className="student-nav-actions">
        {/* Theme Switcher — single toggle */}
        <ThemeToggle />

        {/* Notifications (bell icon + dropdown) */}
        <NotificationDropdown />

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
            <span
              className="nav-avatar-fallback"
              style={{ background: brandIconBg }}
            >
              {initials}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
