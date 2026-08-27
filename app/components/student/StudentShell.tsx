"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { studentAssets } from "./assets";

const studentLinks = [
  ["Profile", "/student", studentAssets.user],
  ["Result", "/student/results", studentAssets.result],
  ["Attendance", "/student/attendance", studentAssets.attendance],
  ["Subjects", "/student/subjects", studentAssets.subjects],
  ["Notes", "/student/notes", studentAssets.assignment],
  ["Schedules", "/student/schedules", studentAssets.schedules],
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
        brandHomeHref: "/student",
        brandIconBg: "#0284c7",
        userName: name,
        userSubtitle: `ID: ${studentId}`,
        avatarUrl,
        notificationCount: 3,
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

