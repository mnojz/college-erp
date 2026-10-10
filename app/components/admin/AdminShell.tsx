"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import {
  IconDashboard,
  IconSchool,
  IconBooks,
  IconFileDescription,
  IconCalendarClock,
  IconUsersGroup,
  IconBell,
  IconUserCheck,
} from "@tabler/icons-react";

const adminLinks = [
  ["Overview", "/dashboard", IconDashboard],
  ["Department", "/admin/setup", IconSchool],
  ["Curriculum", "/admin/curriculum", IconBooks],
  ["Syllabus", "/admin/syllabus", IconFileDescription],
  ["Class Scheduling", "/admin/teaching", IconCalendarClock],
  ["People", "/admin/people", IconUsersGroup],
  ["Profile Reviews", "/admin/profile-reviews", IconUserCheck],
  ["Announcements", "/admin/announcements", IconBell],
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
        brandHomeHref: "/dashboard",
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
