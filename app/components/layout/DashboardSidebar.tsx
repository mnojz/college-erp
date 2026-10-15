"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type NavIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

export type SidebarItem = {
  label: string;
  href: string;
  icon: NavIcon;
  badge?: string | number;
};

export type SidebarTuple = readonly [string, string, NavIcon];

export type SidebarSection = {
  title?: string;
  items: readonly (SidebarTuple | SidebarItem)[];
};

export type SidebarNavItems =
  | readonly (SidebarTuple | SidebarItem)[]
  | readonly SidebarSection[];

export type DashboardSidebarProps = {
  items: SidebarNavItems;
  activeHref?: string;
  isCollapsed?: boolean;
  /** Callback fired when a link is clicked (used to close the mobile sheet). */
  onNavigate?: () => void;
};

function isTuple(item: SidebarTuple | SidebarItem): item is SidebarTuple {
  return Array.isArray(item);
}

function parseItem(item: SidebarTuple | SidebarItem): {
  label: string;
  href: string;
  Icon: NavIcon;
  badge?: string | number;
} {
  if (isTuple(item)) {
    return {
      label: item[0],
      href: item[1],
      Icon: item[2],
      badge: undefined,
    };
  }
  return {
    label: item.label,
    href: item.href,
    Icon: item.icon,
    badge: item.badge,
  };
}

export function DashboardSidebar({
  items,
  activeHref,
  isCollapsed = false,
  onNavigate,
}: DashboardSidebarProps) {
  const currentPath = usePathname();

  const sections: readonly SidebarSection[] = useMemo(() => {
    if (!items || items.length === 0) return [];
    const first = items[0];
    if (
      typeof first === "object" &&
      first !== null &&
      "items" in first &&
      Array.isArray((first as SidebarSection).items)
    ) {
      return items as readonly SidebarSection[];
    }
    return [{ items: items as readonly (SidebarTuple | SidebarItem)[] }];
  }, [items]);

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="flex h-full flex-col select-none">
        <nav
          aria-label="Workspace navigation"
          className={cn(
            "flex flex-1 flex-col overflow-y-auto overflow-x-hidden",
            isCollapsed ? "p-2 gap-2" : "p-3 gap-3"
          )}
        >
          {sections.map((section, sIdx) => (
            <div key={section.title ?? `sec-${sIdx}`} className="space-y-1">
              {section.title && !isCollapsed && (
                <div className="px-3 pt-2 pb-1">
                  <p className="text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase">
                    {section.title}
                  </p>
                </div>
              )}

              {section.title && isCollapsed && sIdx > 0 && (
                <div className="my-2 mx-auto w-6 border-t border-border/70" />
              )}

              <div className={cn("space-y-1", isCollapsed && "flex flex-col items-center")}>
                {section.items.map((rawItem) => {
                  const { label, href, Icon, badge } = parseItem(rawItem);
                  const isActive = activeHref ? activeHref === href : currentPath === href;

                  if (isCollapsed) {
                    return (
                      <Tooltip key={href}>
                        <TooltipTrigger asChild>
                          <Link
                            href={href}
                            onClick={onNavigate}
                            aria-label={label}
                            className={cn(
                              "group relative flex size-10 items-center justify-center rounded-xl transition-all duration-150",
                              isActive
                                ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                            )}
                          >
                            {isActive && (
                              <span
                                className="absolute left-0.5 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                                aria-hidden="true"
                              />
                            )}
                            <Icon
                              size={20}
                              strokeWidth={isActive ? 2.2 : 1.75}
                              className="shrink-0 transition-transform duration-150 group-hover:scale-105"
                            />
                            {badge != null && (
                              <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
                            )}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={12} className="flex items-center gap-2 font-medium">
                          <span>{label}</span>
                          {badge != null && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">
                              {badge}
                            </span>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary"
                          aria-hidden="true"
                        />
                      )}

                      <span
                        className={cn(
                          "flex shrink-0 items-center justify-center transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        <Icon
                          size={18}
                          strokeWidth={isActive ? 2.2 : 1.75}
                          className="shrink-0 transition-transform duration-150 group-hover:scale-105"
                        />
                      </span>

                      <span className="truncate flex-1">{label}</span>

                      {badge != null && (
                        <span
                          className={cn(
                            "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-foreground"
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
