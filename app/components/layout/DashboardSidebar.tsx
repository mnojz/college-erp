"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cn } from "cn";

export type NavIcon = ComponentType<{ size?: string | number; className?: string }>;

export type SidebarItem = {  label: string;
  href: string;
  icon: NavIcon;
};

export type SidebarTuple = readonly [string, string, NavIcon];

export type DashboardSidebarProps = {
  items: readonly SidebarTuple[] | readonly SidebarItem[];
  activeHref?: string;
  /** Callback fired when a link is clicked (used to close the mobile sheet). */
  onNavigate?: () => void;
};

export function DashboardSidebar({
  items,
  activeHref,
  onNavigate,
}: DashboardSidebarProps) {
  const currentPath = usePathname();

  return (
    <aside className="flex h-full flex-col">
      <nav aria-label="Workspace navigation" className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const isTuple = Array.isArray(item);
          const label = isTuple ? item[0] : (item as SidebarItem).label;
          const href = isTuple ? item[1] : (item as SidebarItem).href;
          const Icon = isTuple ? item[2] : (item as SidebarItem).icon;

          const isActive = activeHref ? activeHref === href : currentPath === href;

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive && "bg-accent font-semibold text-foreground"
              )}
            >
              <span className="flex shrink-0 items-center justify-center">
                <Icon size={18} className="[&>svg]:size-4" aria-hidden="true" />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

