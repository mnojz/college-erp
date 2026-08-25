"use client";

import { DashboardNav, DashboardNavProps } from "./DashboardNav";
import { DashboardSidebar, DashboardSidebarProps } from "./DashboardSidebar";

export type DashboardShellProps = {
  // Nav customization
  navProps: DashboardNavProps;
  // Sidebar items
  sidebarItems: DashboardSidebarProps["items"];
  activeHref?: string;
  // Page heading (optional)
  title?: string;
  subtitle?: string;
  // Content
  children: React.ReactNode;
};

export function DashboardShell({
  navProps,
  sidebarItems,
  activeHref,
  title,
  subtitle,
  children,
}: DashboardShellProps) {
  return (
    <div className="student-app-shell">
      <DashboardNav {...navProps} />

      <div className="student-page-body">
        <DashboardSidebar items={sidebarItems} activeHref={activeHref} />

        <main className="student-profile-content">
          {(title || subtitle) && (
            <header className="admin-page-heading">
              {subtitle && <p>{subtitle}</p>}
              {title && <h1>{title}</h1>}
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

