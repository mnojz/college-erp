"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { readShellIdentity, writeShellIdentity } from "@/app/lib/profile-cache";

/**
 * The logged-in user's shell identity — the fields the navbar renders
 * (name, subtitle, avatar). Fetched once from the role-agnostic
 * `/api/auth/me` endpoint and shared with `DashboardNav` via context.
 *
 * Why this exists: every page used to fetch its OWN role profile and
 * manually thread `avatarUrl`/`userName`/`userSubtitle` into the nav.
 * Server-component wrapper pages (e.g. /student/academics,
 * /teacher/resources) don't fetch a profile, so they silently dropped the
 * avatar and fell back to "Student" + initials. By fetching identity once
 * here — at the single choke point every shell passes through — the navbar
 * is correct on every page, and future pages can't re-introduce the bug.
 */
export type ShellIdentity = {
  userName: string;
  userSubtitle: string;
  avatarUrl: string | null;
};

const UserIdentityContext = createContext<ShellIdentity | null>(null);

const PROFILE_CACHE_KEY = "auth/me";

type MeUser = {
  firstName: string;
  lastName: string;
  displayName?: string;
  subtitle?: string;
  profileImageUrl?: string | null;
  student?: { profileImageUrl: string | null } | null;
  teacher?: { profileImageUrl: string | null } | null;
};

export function UserIdentityProvider({ children }: { children: React.ReactNode }) {
  // Hydrate instantly from the module cache so a repeat visit shows the real
  // name/avatar with no flash while the fetch is in flight.
  const cached = readShellIdentity(PROFILE_CACHE_KEY);
  const [identity, setIdentity] = useState<ShellIdentity>(() => {
    if (cached) {
      return {
        userName: `${cached.firstName} ${cached.lastName}`.trim(),
        userSubtitle: cached.subtitle ?? (cached.employeeNo ? `Emp ID: ${cached.employeeNo}` : "Sign out"),
        avatarUrl: cached.profileImageUrl,
      };
    }
    return { userName: "User", userSubtitle: "Sign out", avatarUrl: null };
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        const user: MeUser | undefined = data?.user;
        if (!user || !alive) return;

        const avatarUrl =
          user.profileImageUrl ?? user.student?.profileImageUrl ?? user.teacher?.profileImageUrl ?? null;
        const displayName =
          user.displayName ?? `${user.firstName} ${user.lastName}`.trim();

        const next: ShellIdentity = {
          userName: displayName || "User",
          userSubtitle: user.subtitle ?? "Sign out",
          avatarUrl,
        };
        setIdentity(next);

        // Keep the shared shell cache warm for the next page (identity only).
        writeShellIdentity(PROFILE_CACHE_KEY, {
          firstName: user.firstName,
          lastName: user.lastName,
          employeeNo: "",
          profileImageUrl: avatarUrl,
          subtitle: next.userSubtitle,
        });
      } catch {
        /* Non-fatal: the navbar keeps its cached/default identity. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return <UserIdentityContext.Provider value={identity}>{children}</UserIdentityContext.Provider>;
}

/**
 * Reads the shared shell identity, or `null` when used outside the provider.
 * `DashboardNav` uses this as a FALLBACK: an explicit prop always wins.
 */
export function useShellIdentity(): ShellIdentity | null {
  return useContext(UserIdentityContext);
}