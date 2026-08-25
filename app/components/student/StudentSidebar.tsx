"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AssetIcon, studentAssets } from "./assets";

const items = [
  ["Profile", "/student", studentAssets.user],
  ["Result", "/student/results", studentAssets.result],
  ["Attendance", "/student/attendance", studentAssets.attendance],
  ["Subjects", "/student/subjects", studentAssets.subjects],
  ["Schedules", "/student/schedules", studentAssets.schedules],
] as const;

export function StudentSidebar() {
  const pathname = usePathname();

  return (
    <aside className="student-sidebar">
      <nav aria-label="Student navigation">
        {items.map(([label, href, icon]) => {
          const isActive = pathname === href;
          return (
            <Link
              className={`student-sidebar-link ${isActive ? "active" : ""}`}
              href={href}
              key={label}
            >
              <AssetIcon src={icon} size={20} />
              <span>{label}</span>
              {isActive && <i />}
            </Link>
          );
        })}
      </nav>
      <div className="student-support">
        <strong>Need Support?</strong>
        <p>Contact campus helpdesk for academic and technical queries.</p>
        <a href="mailto:helpdesk@college.edu">Contact Helpdesk</a>
      </div>
    </aside>
  );
}
