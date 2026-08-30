"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown, IconLogout, IconSchool, IconUser } from "@tabler/icons-react";
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
  /** Where the "View profile" menu item links to. */
  profileHref?: string;
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
  profileHref = "/profile",
  onLogout,
}: DashboardNavProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside it or pressing Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

                {/* User Account — dropdown with profile + logout */}
        <div ref={dropdownRef} className="student-nav-user-wrap">
          <button
            className="student-user-trigger"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Open user menu"
          >
            <span>
              <strong>{userName}</strong>
              <small>{userSubtitle}</small>
            </span>
            <IconChevronDown size={14} aria-hidden="true" />
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

          {open && (
            <div className="user-dropdown" role="menu" aria-orientation="vertical">
              <Link
                href={profileHref}
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <IconUser size={14} aria-hidden="true" />
                View profile
              </Link>
              <button
                type="button"
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  handleLogout();
                }}
              >
                <IconLogout size={14} aria-hidden="true" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
