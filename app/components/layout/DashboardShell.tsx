"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { DashboardNav, DashboardNavProps } from "./DashboardNav";
import { DashboardSidebar, DashboardSidebarProps } from "./DashboardSidebar";
import { UserIdentityProvider } from "./UserIdentityProvider";
import { Button } from "@/components/ui/button";
import { Logo } from "@/app/components/common/Logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type DashboardShellProps = {
  // Nav customization
  navProps: DashboardNavProps;
  // Sidebar items
  sidebarItems: DashboardSidebarProps["items"];
  activeHref?: string;
  // Page heading (optional)
  title?: string;
  subtitle?: string;
  /** Optional actions rendered on the same line as the page heading. */
  headerActions?: React.ReactNode;
  // Content
  children: React.ReactNode;
};

export function DashboardShell({
  navProps,
  sidebarItems,
  activeHref,
  title,
  subtitle,
  headerActions,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Automatically collapse sidebar when viewport width < 1280px (xl breakpoint)
    const mql = window.matchMedia("(max-width: 1279px)");
    setIsCollapsed(mql.matches);

    function handleMediaChange(e: MediaQueryListEvent) {
      setIsCollapsed(e.matches);
    }

    mql.addEventListener("change", handleMediaChange);
    return () => mql.removeEventListener("change", handleMediaChange);
  }, []);

  const menuButton = (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-1 lg:hidden"
      aria-label="Open navigation menu"
      onClick={() => setSidebarOpen(true)}
    >
      <Menu className="size-5" />
    </Button>
  );

  return (
    <UserIdentityProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Navbar */}
        <DashboardNav {...navProps} menuButton={menuButton} />

        <div className="mx-auto flex w-full max-w-360 flex-1 flex-col lg:flex-row">
          {/* Desktop collapsible sidebar */}
          <aside
            className={cn(
              "hidden lg:block shrink-0 transition-[width] duration-200 ease-in-out border-r border-border/70 bg-sidebar/40",
              isCollapsed ? "w-18" : "w-64"
            )}
          >
            <div className="sticky top-14 sm:top-15 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-3.75rem)]">
              <DashboardSidebar
                items={sidebarItems}
                activeHref={activeHref}
                isCollapsed={isCollapsed}
              />
            </div>
          </aside>

          <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 lg:px-10 transition-all duration-200">
            {(title || subtitle || headerActions) && (
              <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  {subtitle && (
                    <p className="mb-1 text-sm font-medium text-muted-foreground">{subtitle}</p>
                  )}
                  {title && (
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                  )}
                </div>
                {headerActions && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2.5">{headerActions}</div>
                )}
              </header>
            )}
            {children}
          </main>
        </div>

        {/* Mobile sidebar drawer */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 gap-0 border-r border-border/80 bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs">
            <SheetHeader className="border-b border-border/70 px-4 py-3.5">
              <SheetTitle className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                <Logo className="size-6 text-primary shrink-0" />
                <span>Navigation</span>
              </SheetTitle>
            </SheetHeader>
            <DashboardSidebar
              items={sidebarItems}
              activeHref={activeHref}
              onNavigate={() => setSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </UserIdentityProvider>
  );
}
