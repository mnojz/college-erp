"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

export type NavIcon = ComponentType<{ size?: string | number; className?: string }>;

export type SidebarItem = {
  label: string;
  href: string;
  icon: NavIcon;
};

export type SidebarTuple = readonly [string, string, NavIcon];

export type DashboardSidebarProps = {
  items: readonly SidebarTuple[] | readonly SidebarItem[];
  activeHref?: string;
};

export function DashboardSidebar({ items, activeHref }: DashboardSidebarProps) {
  const currentPath = usePathname();

  return (
    <aside className="student-sidebar">
      <nav aria-label="Workspace navigation">
        {items.map((item) => {
          const isTuple = Array.isArray(item);
          const label = isTuple ? item[0] : (item as SidebarItem).label;
          const href = isTuple ? item[1] : (item as SidebarItem).href;
          const Icon = isTuple ? item[2] : (item as SidebarItem).icon;

          const isActive = activeHref ? activeHref === href : currentPath === href;

          return (
            <Link
              key={href}
              className={`student-sidebar-link ${isActive ? "active" : ""}`}
              href={href}
            >
              <span className="student-sidebar-icon">
                <Icon size={19} className="tabular-icon" aria-hidden="true" />
              </span>
              <span>{label}</span>
              {isActive && <i />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

