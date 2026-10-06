"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLogin } from "@tabler/icons-react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { Logo } from "@/app/components/common/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const NAV_LINKS = [
  { label: "Curriculum", href: "/public/course-structure" },
  { label: "Fees", href: "/public/fee-structure" },
  { label: "Syllabus", href: "/public/syllabus" },
  { label: "Notices", href: "/public/notices" },
] as const;

export function PublicNavbar({
  onSignInClick,
}: {
  onSignInClick: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="size-8 text-foreground" />
          <span className="flex flex-col leading-tight">
            <strong className="text-sm font-semibold">College-ERP</strong>
            <small className="hidden text-xs text-muted-foreground sm:block">
              Far Western University
            </small>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                pathname === link.href && "bg-accent font-semibold text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button
            type="button"
            className="hidden sm:inline-flex"
            onClick={onSignInClick}
          >
            <IconLogin size={16} aria-hidden="true" />
            Sign In
          </Button>
          <Button
            type="button"
            className="sm:hidden"
            size="icon"
            variant="outline"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Menu className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav
          className="border-t bg-background px-4 py-3 md:hidden"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-[15px] font-medium text-foreground hover:bg-accent hover:text-foreground",
                  pathname === link.href && "bg-accent font-semibold text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Button
              type="button"
              className="mt-2 sm:hidden"
              onClick={() => {
                setMobileOpen(false);
                onSignInClick();
              }}
            >
              <IconLogin size={16} aria-hidden="true" />
              Sign In
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
