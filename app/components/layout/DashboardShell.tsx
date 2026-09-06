"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { DashboardNav, DashboardNavProps } from "./DashboardNav";
import { DashboardSidebar, DashboardSidebarProps } from "./DashboardSidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <DashboardNav {...navProps} menuButton={menuButton} />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <DashboardSidebar items={sidebarItems} activeHref={activeHref} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
        <SheetContent side="left" className="w-72 gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-sm font-semibold">Navigation</SheetTitle>
          </SheetHeader>
          <DashboardSidebar
            items={sidebarItems}
            activeHref={activeHref}
            onNavigate={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
