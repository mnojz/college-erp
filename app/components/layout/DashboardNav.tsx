"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { NotificationDropdown } from "@/app/components/common/NotificationDropdown";
import { Logo } from "@/app/components/common/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DashboardNavProps = {
  brandTitle?: string;
  brandSubtitle?: string;
  brandHomeHref?: string;
  userName?: string;
  userSubtitle?: string;
  avatarUrl?: string | null;
  /** Where the "View profile" menu item links to. */
  profileHref?: string;
  onLogout?: () => void;
  /** Slot used by DashboardShell to render the mobile sidebar toggle. */
  menuButton?: ReactNode;
};

export function DashboardNav({
  brandTitle = "College-ERP",
  brandSubtitle = "Academic Terminal",
  brandHomeHref = "/",
  userName = "User",
  userSubtitle = "Sign out",
  avatarUrl,
  profileHref = "/profile",
  onLogout,
  menuButton,
}: DashboardNavProps) {
  const router = useRouter();

  async function handleLogout() {
    if (onLogout) {
      onLogout();
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  const initials =
    userName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
        {menuButton}

        <Link
          href={brandHomeHref}
          className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo className="size-8 text-foreground" />
          <span className="flex min-w-0 flex-col leading-tight">
            <strong className="truncate text-sm font-semibold">{brandTitle}</strong>
            <small className="hidden truncate text-xs text-muted-foreground sm:block">
              {brandSubtitle}
            </small>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <ThemeToggle />
          <NotificationDropdown />

          <div className="ml-4 sm:ml-6">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 px-1.5 sm:px-2"
                aria-label="Open user menu"
              >
                <span className="hidden flex-col items-end leading-tight sm:flex">
                  <strong className="max-w-40 truncate text-xs font-semibold">{userName}</strong>
                  <small className="max-w-40 truncate text-[10px] text-muted-foreground">
                    {userSubtitle}
                  </small>
                </span>
                <Avatar>
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={userName} /> : null}
                  <AvatarFallback className="bg-primary/10 font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem asChild>
                <Link href={profileHref} className="gap-2">
                  <User className="size-4" aria-hidden="true" />
                  View profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="gap-2"
                onSelect={() => {
                  handleLogout();
                }}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
