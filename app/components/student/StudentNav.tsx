"use client";

import { DashboardNav } from "@/app/components/layout/DashboardNav";

type StudentNavProps = {
  name: string;
  studentId: string;
  avatarUrl?: string | null;
};

export function StudentNav({ name, studentId, avatarUrl }: StudentNavProps) {
  return (
    <DashboardNav
      brandTitle="College-ERP"
      brandSubtitle="Student Portal"
      brandHomeHref="/student"
      brandIconBg="#0284c7"
      userName={name}
      userSubtitle={`ID: ${studentId}`}
      avatarUrl={avatarUrl}
      notificationCount={3}
    />
  );
}
