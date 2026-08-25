"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AssetIcon } from "@/app/components/student/assets";

export type SidebarItem = {
  label: string;
  href: string;
  icon: string;
};

export type SidebarTuple = readonly [string, string, string];

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
          const icon = isTuple ? item[2] : (item as SidebarItem).icon;

          const isActive = activeHref ? activeHref === href : currentPath === href;

          return (
            <Link
              key={href}
              className={`student-sidebar-link ${isActive ? "active" : ""}`}
              href={href}
            >
              <AssetIcon src={icon} size={19} />
              <span>{label}</span>
              {isActive && <i />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

