"use client";

import { useTheme } from "@/app/lib/useTheme";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

/**
 * Theme toggle styled as a shadcn ghost icon button. Uses the shared
 * useTheme store so every consumer (navbars, shells) stays in sync.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={className}
      onClick={toggleTheme}
    >
      {dark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}

