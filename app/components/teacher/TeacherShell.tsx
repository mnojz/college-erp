"use client";

import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { studentAssets } from "@/app/components/student/assets";

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
  ["Overview", "/teacher", studentAssets.academic],
  ["Attendance", "/teacher/attendance", studentAssets.subjects],
  ["Class Schedule", "/teacher/schedule", studentAssets.schedules],
  ["Assessments & Marks", "/teacher/assessments", studentAssets.user],
  ["My Uploads", "/teacher/materials", studentAssets.finance],
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
