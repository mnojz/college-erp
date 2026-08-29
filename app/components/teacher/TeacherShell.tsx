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
  children: React.ReactNode;
};

const teacherLinks = [
  ["Overview", "/teacher", IconDashboard],
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
  children,
}: TeacherShellProps) {
  return (
    <DashboardShell
      navProps={{
        brandTitle: "College-ERP",
        brandSubtitle: "Faculty Portal",
        brandHomeHref: "/teacher",
        brandIconBg: "#0ea5e9",
        userName: teacherName,
        userSubtitle: `Emp ID: ${employeeNo}`,
        avatarUrl,
        notificationCount: 2,
      }}
      sidebarItems={teacherLinks}
      activeHref={active}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </DashboardShell>
  );
}
