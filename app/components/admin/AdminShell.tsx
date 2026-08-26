"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { studentAssets } from "@/app/components/student/assets";

const adminLinks = [
  ["Overview", "/admin", studentAssets.academic],
  ["Programs", "/admin/setup", studentAssets.subjects],
  ["Curriculum", "/admin/curriculum", studentAssets.school],
  ["Class Scheduling", "/admin/teaching", studentAssets.schedules],
  ["People", "/admin/people", studentAssets.user],
  ["Announcements", "/admin/announcements", studentAssets.bell],
] as const;

export function AdminShell({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      navProps={{
        brandTitle: "College-ERP",
        brandSubtitle: "Administration",
        brandHomeHref: "/admin",
        brandIconBg: "#0284c7",
        userName: "Administrator",
        userSubtitle: "Sign out",
      }}
      sidebarItems={adminLinks}
      activeHref={active}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </DashboardShell>
  );
}
