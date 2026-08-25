"use client";

import { DashboardSidebar } from "@/app/components/layout/DashboardSidebar";
import { studentAssets } from "./assets";

const items = [
  ["Profile", "/student", studentAssets.user],
  ["Result", "/student/results", studentAssets.result],
  ["Attendance", "/student/attendance", studentAssets.attendance],
  ["Subjects", "/student/subjects", studentAssets.subjects],
  ["Schedules", "/student/schedules", studentAssets.schedules],
] as const;

export function StudentSidebar({ active }: { active?: string }) {
  return <DashboardSidebar items={items} activeHref={active} />;
}
