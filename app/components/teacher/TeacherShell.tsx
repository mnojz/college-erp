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
  ["Assessments & Marks", "/teacher/assessments", IconClipboardCheck],
  ["Announcements", "/teacher/announcements", IconBell],
  ["My Uploads", "/teacher/materials", IconUpload],
] as const;

export function TeacherShell({
  title,
  subtitle,
  active,
  teacherName = "Faculty Member",
  employeeNo = "FWU-FACULTY",
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
        userName: teacherName,
        userSubtitle: `Emp ID: ${employeeNo}`,
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
