"use client";

import Link from "next/link";
import { AssetIcon, studentAssets } from "./assets";

const items = [
  ["Profile", "/student", studentAssets.user],
  ["Result", "/student/results", studentAssets.result],
  ["Attendance", "/student/attendance", studentAssets.attendance],
  ["Subjects", "/student/subjects", studentAssets.subjects],
  ["Finance", "/student/finance", studentAssets.finance],
  ["Assignment", "/student/assignments", studentAssets.assignment],
  ["Schedules", "/student/schedules", studentAssets.schedules],
] as const;

export function StudentSidebar() {
  return (
    <aside className="student-sidebar">
      <nav aria-label="Student navigation">
        {items.map(([label, href, icon], index) => (
          <Link className={`student-sidebar-link ${index === 0 ? "active" : ""}`} href={href} key={label}>
            <AssetIcon src={icon} size={20} />
            <span>{label}</span>
            {index === 0 && <i />}
          </Link>
        ))}
      </nav>
      <div className="student-support">
        <strong>Need Support?</strong>
        <p>Contact campus helpdesk for enrollment and fee queries.</p>
        <a href="mailto:helpdesk@college.edu">Contact Helpdesk</a>
      </div>
    </aside>
  );
}
