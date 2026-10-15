"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { type SidebarSection } from "@/app/components/layout/DashboardSidebar";
import {
  IconDashboard,
  IconSchool,
  IconBooks,
  IconFileDescription,
  IconCalendarClock,
  IconUsersGroup,
  IconBell,
  IconUserCheck,
  IconCertificate,
} from "@tabler/icons-react";

const adminSections: readonly SidebarSection[] = [
  {
    title: "Main",
    items: [
      ["Overview", "/dashboard", IconDashboard],
      ["Announcements", "/admin/announcements", IconBell],
    ],
  },
  {
    title: "Academic Setup",
    items: [
      ["Department", "/admin/setup", IconSchool],
      ["Curriculum", "/admin/curriculum", IconBooks],
      ["Syllabus", "/admin/syllabus", IconFileDescription],
      ["Class Scheduling", "/admin/teaching", IconCalendarClock],
      ["Examinations", "/admin/exams", IconCertificate],
    ],
  },
  {
    title: "User Management",
    items: [
      ["People", "/admin/people", IconUsersGroup],
      ["Profile Reviews", "/admin/profile-reviews", IconUserCheck],
    ],
  },
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
        // No identity props: the shared UserIdentityProvider supplies the
        // admin's real name (and avatar, once one is uploaded) on every page.
      }}
      sidebarItems={adminSections}
      activeHref={active}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </DashboardShell>
  );
}
