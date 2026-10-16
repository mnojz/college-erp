"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  id: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  badge?: React.ReactNode;
  disabled?: boolean;
};

export type TabSwitcherProps<T extends string = string> = {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
  ariaLabel?: string;
};

export function TabSwitcher<T extends string = string>({
  tabs,
  value,
  onChange,
  className,
  size = "default",
  ariaLabel = "Tab options",
}: TabSwitcherProps<T>) {
  // Compact, reduced-height sizes with refined rounded-lg curvature
  const sizeClasses = {
    sm: "h-6 px-2 text-[11px] gap-1 rounded-md",
    default: "h-6.5 sm:h-7 px-2.5 sm:px-3 text-xs font-semibold gap-1.5 rounded-lg",
    lg: "h-7.5 sm:h-8 px-3.5 text-xs sm:text-sm font-semibold gap-2 rounded-lg",
  };

  const iconSizes = {
    sm: 11,
    default: 13,
    lg: 15,
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 sm:gap-1 rounded-xl border border-slate-300/80 bg-slate-200/90 p-0.5 shadow-2xs select-none dark:border-white/10 dark:bg-slate-950/85",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        const IconComponent = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={cn(
              "flex items-center justify-center transition-all cursor-pointer font-semibold",
              sizeClasses[size],
              isActive
                ? "bg-white text-slate-950 shadow-xs ring-1 ring-black/5 dark:bg-slate-800 dark:text-white dark:ring-1 dark:ring-white/15 dark:shadow-xs"
                : "text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100",
              tab.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            {IconComponent && (
              <IconComponent
                size={iconSizes[size]}
                className={cn(
                  "shrink-0 transition-colors",
                  isActive ? "text-primary dark:text-primary" : "text-slate-500 dark:text-slate-400"
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <Badge
                className={cn(
                  "ml-0.5 px-1.5 py-0 text-[10px] font-bold transition-colors border-0",
                  isActive
                    ? "bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary"
                    : "bg-slate-400/20 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300"
                )}
              >
                {tab.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
