"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { type SidebarSection } from "@/app/components/layout/DashboardSidebar";

import {
  IconUser,
  IconReport,
  IconCalendarCheck,
  IconBook2,
  IconNotebook,
  IconReceipt,
  IconCalendarClock,
  IconClipboardCheck,
  IconBell,
} from "@tabler/icons-react";

const studentSections: readonly SidebarSection[] = [
  {
    title: "Main",
    items: [
      ["Profile", "/dashboard", IconUser],
      ["Notice", "/student/notice", IconBell],
    ],
  },
  {
    title: "Academics",
    items: [
      ["Attendance", "/student/attendance", IconCalendarCheck],
      ["Academics", "/student/academics", IconBook2],
      ["Schedules", "/student/schedules", IconCalendarClock],
      ["Notes", "/student/notes", IconNotebook],
    ],
  },
  {
    title: "Records & Finance",
    items: [
      ["Results", "/student/results", IconReport],
      ["Exams", "/student/exams", IconClipboardCheck],
      ["Fees", "/student/fees", IconReceipt],
    ],
  },
] as const;

export type StudentShellProps = {
  active?: string;
  name?: string;
  studentId?: string;
  avatarUrl?: string | null;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function StudentShell({
  active,
  name,
  studentId,
  avatarUrl,
  title,
  subtitle,
  children,
}: StudentShellProps) {
  return (
    <DashboardShell
      navProps={{
        brandTitle: "College-ERP",
        brandSubtitle: "",
        brandHomeHref: "/dashboard",
        // Pass through only when the page provides identity; otherwise the
        // shared UserIdentityProvider fills name/subtitle/avatar so wrapper
        // pages (e.g. /student/academics) still show the real student.
        userName: name,
        userSubtitle: studentId ? `ID: ${studentId}` : undefined,
        avatarUrl,
      }}
      sidebarItems={studentSections}
      activeHref={active}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </DashboardShell>
  );
}
