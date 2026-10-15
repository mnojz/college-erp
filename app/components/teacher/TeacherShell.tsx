"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { type SidebarSection } from "@/app/components/layout/DashboardSidebar";
import {
  IconBell,
  IconCalendarCheck,
  IconCalendarClock,
  IconClipboardCheck,
  IconDashboard,
  IconUpload,
} from "@tabler/icons-react";

type TeacherShellProps = {
  title?: string;
  subtitle?: string;
  active?: string;
  teacherName?: string;
  employeeNo?: string;
  avatarUrl?: string | null;
  /** Optional actions rendered on the same line as the page heading. */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

const teacherSections: readonly SidebarSection[] = [
  {
    title: "Main",
    items: [
      ["Overview", "/dashboard", IconDashboard],
      ["Announcements", "/teacher/announcements", IconBell],
    ],
  },
  {
    title: "Teaching Hub",
    items: [
      ["Attendance", "/teacher/attendance", IconCalendarCheck],
      ["Class Schedule", "/teacher/schedule", IconCalendarClock],
      ["Exam Marks", "/teacher/exams", IconClipboardCheck],
      ["My Uploads", "/teacher/materials", IconUpload],
    ],
  },
] as const;

export function TeacherShell({
  title,
  subtitle,
  active,
  teacherName,
  employeeNo,
  avatarUrl,
  headerActions,
  children,
}: TeacherShellProps) {
  return (
    <DashboardShell
      navProps={{
        brandTitle: "College-ERP",
        brandSubtitle: "",
        brandHomeHref: "/dashboard",
        // Pass through only when the page provides identity; otherwise the
        // shared UserIdentityProvider fills name/subtitle/avatar so wrapper
        // pages (e.g. /teacher/resources) still show the real faculty member.
        userName: teacherName,
        userSubtitle: employeeNo ? `Emp ID: ${employeeNo}` : undefined,
        avatarUrl,
      }}
      sidebarItems={teacherSections}
      activeHref={active}
      title={title}
      subtitle={subtitle}
      headerActions={headerActions}
    >
      {children}
    </DashboardShell>
  );
}
