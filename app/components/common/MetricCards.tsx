import type { ReactNode } from "react";

import { cn } from "cn";

/**
 * Responsive stat-card grid used across dashboard overviews.
 * Adapts to any card count (1-6) without empty gaps.
 */
export function MetricGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A single stat card: small uppercase label, large value, optional hint. */
export function MetricCard({
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/30",
        className,
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <strong
        className={cn(
          "my-1 text-[34px] font-bold leading-none tracking-tight",
          valueClassName,
        )}
      >
        {value}
      </strong>
      {hint && <small className="text-xs text-muted-foreground">{hint}</small>}
    </article>
  );
}

/** Bordered content panel used for grouped sections (info cards, lists). */
export function PanelCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-xs", className)}>
      {children}
    </section>
  );
}

/** Centered placeholder for empty lists / missing data. */
export function EmptyState({
  title,
  children,
  dashed = false,
  className,
}: {
  title?: string;
  children?: ReactNode;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-8 py-10 text-center text-sm text-muted-foreground",
        dashed && "rounded-xl border border-dashed",
        className,
      )}
    >
      {title && <h3 className="m-0 mb-2 text-base font-bold text-foreground">{title}</h3>}
      {children && <div className="leading-relaxed">{children}</div>}
    </div>
  );
}
