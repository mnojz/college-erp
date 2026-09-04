"use client";

import { DashboardSidebar } from "@/app/components/layout/DashboardSidebar";
import {
  IconUser,
  IconReport,
  IconCalendarCheck,
  IconBook2,
  IconNotebook,
  IconFileDescription,
  IconCalendarClock,
} from "@tabler/icons-react";

const items = [
  ["Profile", "/dashboard", IconUser],
  ["Result", "/student/results", IconReport],
  ["Attendance", "/student/attendance", IconCalendarCheck],
  ["Subjects", "/student/subjects", IconBook2],
  ["Notes", "/student/notes", IconNotebook],
  ["Syllabus", "/student/syllabus", IconFileDescription],
  ["Schedules", "/student/schedules", IconCalendarClock],
] as const;

export function StudentSidebar({ active }: { active?: string }) {
  return <DashboardSidebar items={items} activeHref={active} />;
}
