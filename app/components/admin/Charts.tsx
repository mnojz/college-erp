"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Lightweight, dependency-free charts for the admin Overview. Styled entirely
 * with the app's Catppuccin accent variables so they stay legible in both light
 * and dark themes. Deliberately simple — no tooltips/animations — because the
 * dashboard needs a few robust distributions, not an analytics suite.
 */

const CYCLIC_ACCENTS = [
  "var(--ctp-blue)",
  "var(--ctp-green)",
  "var(--ctp-mauve)",
  "var(--ctp-peach)",
  "var(--ctp-teal)",
  "var(--ctp-yellow)",
  "var(--ctp-sky)",
  "var(--ctp-pink)",
] as const;

function accentFor(index: number): string {
  return CYCLIC_ACCENTS[index % CYCLIC_ACCENTS.length];
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="m-0 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export type BarDatum = { label: string; value: number };

/** Horizontal bars — best when category labels are long (program names/codes). */
export function BarChartCard({
  title,
  data,
  emptyNote = "No data yet.",
}: {
  title: string;
  data: BarDatum[];
  emptyNote?: string;
}) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || max === 0 ? (
          <EmptyNote>{emptyNote}</EmptyNote>
        ) : (
          <ul className="m-0 grid gap-2.5 p-0">
            {data.map((d, i) => (
              <li key={d.label} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-foreground">{d.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{d.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.round((d.value / max) * 100)}%`, background: accentFor(i) }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Vertical columns — best for an ordered numeric axis (semesters 1..8). */
export function ColumnChartCard({
  title,
  data,
  emptyNote = "No data yet.",
}: {
  title: string;
  data: BarDatum[];
  emptyNote?: string;
}) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || max === 0 ? (
          <EmptyNote>{emptyNote}</EmptyNote>
        ) : (
          <div className="flex h-44 items-end gap-2">
            {data.map((d) => (
              <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-foreground">{d.value}</span>
                <div
                  className="w-full rounded-t-md bg-[var(--ctp-blue)] transition-[height] duration-500"
                  style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
                />
                <span className="text-xs text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type LifecycleData = { active: number; graduated: number; dropped: number };

/**
 * Donut (SVG) for the student lifecycle split. Segments are drawn as stroke
 * arcs on a single circle; the legend lists each state with its count.
 */
export function LifecycleDonutCard({ data }: { data: LifecycleData }) {
  const total = data.active + data.graduated + data.dropped;
  const segments: Array<{ key: keyof LifecycleData; label: string; color: string }> = [
    { key: "active", label: "Active", color: "var(--ctp-green)" },
    { key: "graduated", label: "Graduated", color: "var(--ctp-blue)" },
    { key: "dropped", label: "Dropped", color: "var(--ctp-red)" },
  ];

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Student lifecycle</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyNote>No students yet.</EmptyNote>
        ) : (
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 140 140" className="size-32 shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--muted)" strokeWidth="16" />
              {segments.map((seg) => {
                const value = data[seg.key];
                if (value === 0) return null;
                const fraction = value / total;
                const dash = fraction * circumference;
                const el = (
                  <circle
                    key={seg.key}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += dash;
                return el;
              })}
            </svg>
            <ul className="m-0 grid gap-2 p-0 text-sm">
              {segments.map((seg) => (
                <li key={seg.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{ background: seg.color }}
                  />
                  <span className="text-muted-foreground">{seg.label}</span>
                  <span className="ml-auto font-semibold tabular-nums text-foreground">
                    {data[seg.key]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
