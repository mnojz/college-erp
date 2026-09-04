"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";

import {
  IconUser,
  IconReport,
  IconCalendarCheck,
  IconBook2,
  IconNotebook,
  IconFileDescription,
  IconCalendarClock,
} from "@tabler/icons-react";

const studentLinks = [
  ["Profile", "/dashboard", IconUser],
  ["Result", "/student/results", IconReport],
  ["Attendance", "/student/attendance", IconCalendarCheck],
  ["Subjects", "/student/subjects", IconBook2],
  ["Notes", "/student/notes", IconNotebook],
  ["Syllabus", "/student/syllabus", IconFileDescription],
  ["Schedules", "/student/schedules", IconCalendarClock],
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
  name = "Student",
  studentId = "FWU-STUDENT",
  avatarUrl,
  title,
  subtitle,
  children,
}: StudentShellProps) {
  return (
    <DashboardShell
      navProps={{
        brandTitle: "College-ERP",
        brandSubtitle: "Student Portal",
        brandHomeHref: "/dashboard",
        brandIconBg: "#0284c7",
        userName: name,
        userSubtitle: `ID: ${studentId}`,
        avatarUrl,
      }}
      sidebarItems={studentLinks}
      activeHref={active}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </DashboardShell>
  );
}

