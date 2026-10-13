"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import {
  IconBell,
  IconCalendarCheck,
  IconCalendarClock,
  IconClipboardCheck,
  IconDashboard,
  IconUpload,
} from "@tabler/icons-react";

type TeacherShellProps = {
  title: string;
  subtitle: string;
  active?: string;
  teacherName?: string;
  employeeNo?: string;
  avatarUrl?: string | null;
  /** Optional actions rendered on the same line as the page heading. */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

const teacherLinks = [
  ["Overview", "/dashboard", IconDashboard],
  ["Attendance", "/teacher/attendance", IconCalendarCheck],
  ["Class Schedule", "/teacher/schedule", IconCalendarClock],
  ["Exam Marks", "/teacher/exams", IconClipboardCheck],
  ["Announcements", "/teacher/announcements", IconBell],
  ["My Uploads", "/teacher/materials", IconUpload],
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
        brandSubtitle: "Faculty Portal",
        brandHomeHref: "/dashboard",
        // Pass through only when the page provides identity; otherwise the
        // shared UserIdentityProvider fills name/subtitle/avatar so wrapper
        // pages (e.g. /teacher/resources) still show the real faculty member.
        userName: teacherName,
        userSubtitle: employeeNo ? `Emp ID: ${employeeNo}` : undefined,
        avatarUrl,
      }}
      sidebarItems={teacherLinks}
      activeHref={active}
      title={title}
      subtitle={subtitle}
      headerActions={headerActions}
    >
      {children}
    </DashboardShell>
  );
}
