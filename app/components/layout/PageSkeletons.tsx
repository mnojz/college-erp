import { Skeleton } from "@/components/ui/skeleton";

/**
 * Reusable loading skeletons that mirror the real page layouts, so a page can
 * keep its shell (navbar + sidebar + heading) mounted and only shimmer the
 * content area while data loads — instead of flashing a blank "Loading…" page.
 *
 * Shapes are intentionally generic (stat-card rows, list rows, section blocks)
 * so every dashboard page can reuse the same building blocks.
 */

/** One KPI / stat card skeleton — matches the app's `[&>span]` metric-card shape. */
export function StatCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-5 shadow-xs">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

/**
 * A responsive row of stat-card skeletons. `count` selects the same column
 * layout the real pages use (3 → xl:grid-cols-3, 2 → sm:grid-cols-2, else 4).
 */
export function MetricGridSkeleton({ count = 4 }: { count?: number }) {
  const cols =
    count === 3
      ? "sm:grid-cols-2 xl:grid-cols-3"
      : count === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 xl:grid-cols-4";
  return (
    <section className={`grid grid-cols-1 gap-4 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </section>
  );
}

/** A stack of row-shaped skeletons (icon tile + two text lines + trailing actions). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border bg-background px-3.5 py-3"
        >
          <Skeleton className="size-10 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A titled section with a few row placeholders — for day/section-style pages. */
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mt-3.5 grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
        ))}
      </div>
    </section>
  );
}
