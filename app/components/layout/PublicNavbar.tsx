"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLogin } from "@tabler/icons-react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { Logo } from "@/app/components/common/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70 shadow-2xs transition-colors duration-150">
      <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs group-hover:bg-primary/15 transition-all duration-200">
            <Logo className="size-5 text-primary" />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                College-ERP
              </span>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-[10px] font-semibold py-0 px-1.5 bg-muted/40 text-muted-foreground border-border/70"
              >
                Far Western University
              </Badge>
            </div>
            <span className="sm:hidden text-[10px] text-muted-foreground">
              Far Western University
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Button key={link.href} variant="ghost" size="sm" asChild>
              <Link
                href={link.href}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
                  pathname === link.href
                    ? "bg-accent text-accent-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/30 p-0.5 rounded-lg border border-border/50">
            <ThemeToggle className="size-8 rounded-md hover:bg-background hover:text-foreground text-muted-foreground transition-colors" />
          </div>

          <Button
            type="button"
            size="sm"
            className="hidden sm:inline-flex gap-1.5 font-semibold shadow-2xs"
            onClick={onSignInClick}
          >
            <IconLogin size={15} aria-hidden="true" />
            <span>Sign In</span>
          </Button>

          <Button
            type="button"
            className="sm:hidden size-9"
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
          className="border-t border-border/70 bg-card px-4 py-3 md:hidden shadow-lg"
          aria-label="Mobile"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
                  pathname === link.href && "bg-accent font-bold text-accent-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-2 mt-1 border-t border-border/60">
              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5 font-semibold"
                onClick={() => {
                  setMobileOpen(false);
                  onSignInClick();
                }}
              >
                <IconLogin size={15} aria-hidden="true" />
                <span>Sign In to Portal</span>
              </Button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
