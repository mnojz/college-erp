"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { IconId, IconUsersGroup } from "@tabler/icons-react";

const profileLinks = [
  ["My Profile", "/profile", IconId],
  ["Directory", "/directory", IconUsersGroup],
] as const;

type Me = {
  id: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  status?: string;
};

const ROLE_LABELS: Record<Me["role"], string> = {
  STUDENT: "Student",
  TEACHER: "Faculty member",
  ADMIN: "Administrator",
};

const ROLE_HOMES: Record<Me["role"], string> = {
  STUDENT: "/dashboard",
  TEACHER: "/dashboard",
  ADMIN: "/dashboard",
};

const ROLE_ICON_BG: Record<Me["role"], string> = {
  STUDENT: "#0284c7",
  TEACHER: "#0ea5e9",
  ADMIN: "#dc2626",
};

/**
 * Shell for the shared /profile and /directory pages. Works for every role:
 * resolves the session for the top nav and shows Profile/Directory sidebar
 * links instead of role-specific ones.
 */
export function ProfileShell({
  activeHref,
  title,
  subtitle,
  children,
}: {
  activeHref?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: Me } | null) => {
        if (cancelled) return;
        if (data?.user && data.user.status !== "INACTIVE") setMe(data.user);
        else router.replace("/dashboard");
      })
      .catch(() => {
        if (!cancelled) router.replace("/dashboard");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!me) return null; // avoid flashing an empty shell while resolving the session

  return (
    <DashboardShell
      navProps={{
        brandTitle: "College-ERP",
        brandSubtitle: `${ROLE_LABELS[me.role]} Portal`,
        brandHomeHref: ROLE_HOMES[me.role],
        brandIconBg: ROLE_ICON_BG[me.role],
        userName: `${me.firstName} ${me.lastName}`.trim(),
        userSubtitle: ROLE_LABELS[me.role],
      }}
      sidebarItems={profileLinks}
      activeHref={activeHref}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </DashboardShell>
  );
}