"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChevronDown,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { NotificationDropdown } from "@/app/components/common/NotificationDropdown";
import { Logo } from "@/app/components/common/Logo";
import { clearProfileCache } from "@/app/lib/profile-cache";
import { useShellIdentity } from "./UserIdentityProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DashboardNavProps = {
  brandTitle?: string;
  brandSubtitle?: string;
  brandHomeHref?: string;
  /** Omit to fall back to the shared identity (see UserIdentityProvider). */
  userName?: string;
  userSubtitle?: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
  /** Slot used by DashboardShell to render the mobile sidebar toggle. */
  menuButton?: ReactNode;
  /** Optional center slot (e.g. search or breadcrumbs). */
  centerSlot?: ReactNode;
  /** Optional custom actions. */
  children?: ReactNode;
};

export function DashboardNav({
  brandTitle = "College-ERP",
  brandSubtitle = "Academic Terminal",
  brandHomeHref = "/",
  userName,
  userSubtitle,
  avatarUrl,
  onLogout,
  menuButton,
  centerSlot,
  children,
}: DashboardNavProps) {
  const router = useRouter();

  // Shared identity fetched once in DashboardShell. Explicit props always win.
  const identity = useShellIdentity();
  const displayName = userName ?? identity?.userName ?? "User";
  const displaySubtitle = userSubtitle ?? identity?.userSubtitle ?? "Sign out";
  const displayAvatar = avatarUrl ?? identity?.avatarUrl ?? null;

  async function handleLogout() {
    clearProfileCache();
    if (onLogout) {
      onLogout();
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70 shadow-2xs transition-colors duration-150">
      <div className="mx-auto flex h-14 sm:h-15 w-full max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu & Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {menuButton}

          <Link
            href={brandHomeHref}
            className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs group-hover:bg-primary/15 group-hover:scale-102 transition-all duration-200">
              <Logo className="size-5 text-primary" />
            </div>

            <div className="flex flex-col min-w-0 leading-tight">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                  {brandTitle}
                </span>
                {brandSubtitle && (
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex text-[10px] font-semibold py-0 px-1.5 bg-muted/40 text-muted-foreground border-border/70"
                  >
                    {brandSubtitle}
                  </Badge>
                )}
              </div>
              <span className="sm:hidden text-[10px] font-medium text-muted-foreground truncate">
                {brandSubtitle}
              </span>
            </div>
          </Link>
        </div>

        {/* Center Slot (Optional search, breadcrumbs, status) */}
        {centerSlot && (
          <div className="hidden md:flex flex-1 items-center justify-center max-w-md mx-4">
            {centerSlot}
          </div>
        )}

        {/* Right: Actions, Utilities, and Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {children}

          {/* Separated: Theme Toggle Button */}
          <ThemeToggle className="size-9 rounded-lg border border-border/70 bg-card hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all shadow-2xs" />

          {/* Separated: Notification Dropdown Button */}
          <NotificationDropdown className="size-9 rounded-lg border border-border/70 bg-card hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all shadow-2xs" />

          <div className="h-5 w-px bg-border/70 mx-1 hidden sm:block" />

          {/* User Profile Dropdown Pill with Chevron on the Left End */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-2 sm:gap-2.5 rounded-full sm:rounded-xl py-1 px-2 sm:pl-2.5 sm:pr-1.5 border border-border/70 bg-card hover:bg-accent/60 hover:border-border transition-all duration-150 shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 text-left"
                aria-label="Open user menu"
              >
                {/* Arrow-like symbol on the LEFT end of the box */}
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />

                <div className="hidden flex-col items-end leading-tight sm:flex min-w-0">
                  <span className="max-w-36 truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {displayName}
                  </span>
                  <span className="max-w-36 truncate text-[10px] font-medium text-muted-foreground">
                    {displaySubtitle}
                  </span>
                </div>

                <Avatar className="size-8 sm:size-8.5 ring-1.5 ring-border/80 group-hover:ring-primary/40 shadow-xs transition-all shrink-0">
                  {displayAvatar ? <AvatarImage src={displayAvatar} alt={displayName} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="w-60 p-1.5 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-lg"
            >
              {/* Profile Preview in Dropdown */}
              <DropdownMenuLabel className="p-2 font-normal">
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-9 ring-1 ring-border">
                    {displayAvatar ? <AvatarImage src={displayAvatar} alt={displayName} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{displaySubtitle}</p>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="my-1 bg-border/60" />

              <DropdownMenuItem
                variant="destructive"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer"
                onSelect={() => {
                  handleLogout();
                }}
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
