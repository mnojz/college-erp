"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconSortAscending, IconSortDescending } from "@tabler/icons-react";

export type SortDirection = "asc" | "desc";

export type SortOption<T extends string> = {
  value: T;
  label: string;
  /**
   * Direction the control picks the first time this field is selected, so a
   * new field doesn't inherit whatever direction the previous one was on.
   */
  defaultDirection: SortDirection;
};

const DIRECTION_OPTIONS: readonly { value: SortDirection; label: string }[] = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

/**
 * Shared sort control used by the People directory: a square icon button that
 * opens a dropdown listing the sort fields, with ascending/descending below a
 * separator.
 *
 * The icon always reflects the CURRENT direction so the active order is
 * readable without opening the menu, and the title names the active field for
 * the same reason — the button itself is just a square and shows no label.
 *
 * Sorting is a view concern, not a filter one — callers should reset to page 1
 * on change but must not count it in their "active filters" tally.
 */
export function SortControl<T extends string>({
  value,
  direction,
  options,
  onChange,
  className,
  ariaLabel = "Sort by",
  disabled = false,
}: {
  value: T;
  direction: SortDirection;
  options: readonly SortOption<T>[];
  onChange: (value: T, direction: SortDirection) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const activeLabel = options.find((option) => option.value === value)?.label ?? "Sort";
  const Icon = direction === "asc" ? IconSortAscending : IconSortDescending;

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label={ariaLabel}
            title={`${activeLabel} — ${direction === "asc" ? "ascending" : "descending"}`}
          >
            <Icon size={15} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => {
              const option = options.find((o) => o.value === next);
              if (!option) return;
              // Re-picking the same field keeps the direction; a NEW field resets to
              // its own natural direction (so "Roll number" opens ascending).
              onChange(option.value as T, option.value === value ? direction : option.defaultDirection);
            }}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuRadioGroup
            value={direction}
            onValueChange={(next) => {
              if (next === "asc" || next === "desc") onChange(value, next);
            }}
            aria-label="Sort direction"
          >
            {DIRECTION_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
