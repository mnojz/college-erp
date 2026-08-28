"use client";

import { useTheme } from "@/app/lib/useTheme";
import { IconSun, IconMoon } from "@tabler/icons-react";

/**
 * Single-switch theme toggle. A sliding thumb covers either the sun (light)
 * or moon (dark) icon; clicking flips between the two using the shared
 * useTheme store so every consumer (navbars, shells) stays in sync.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle theme"
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`theme-switch ${className}`}
      onClick={toggleTheme}
    >
      <span className="theme-switch-track" aria-hidden="true">
        <span className="theme-switch-icon theme-switch-icon-sun">
          <IconSun size={14} />
        </span>
        <span className="theme-switch-icon theme-switch-icon-moon">
          <IconMoon size={14} />
        </span>
        <span className={`theme-switch-thumb${dark ? " on" : ""}`} />
      </span>
    </button>
  );
}

