"use client";

import { useState } from "react";
import {
  IconBriefcase,
  IconCalendar,
  IconChartBar,
  IconUserCheck,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

export type BarDatum = { label: string; value: number; secondary?: string };

export type LifecycleData = { active: number; graduated: number; dropped: number };

export type WeeklyDayDatum = { day: string; shortDay: string; count: number };

const CHART_PALETTE = [
  { border: "#4f46e5", bg: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400" },
  { border: "#059669", bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { border: "#0284c7", bg: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  { border: "#7c3aed", bg: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
  { border: "#d97706", bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { border: "#e11d48", bg: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  { border: "#0d9488", bg: "bg-teal-500", text: "text-teal-600 dark:text-teal-400" },
  { border: "#ea580c", bg: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
];

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

/** ── 1. Program Distribution Horizontal Bar Chart ── */
export function ProgramDistributionChart({
  title = "Enrollment by Degree Program",
  data,
  totalStudents,
}: {
  title?: string;
  data: BarDatum[];
  totalStudents?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  const total = totalStudents ?? data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="rounded-xl border border-border/70 shadow-xs bg-card overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconBriefcase size={14} />
            </span>
            <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              {title}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-muted/60">
            {data.length} Programs
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {data.length === 0 || max === 0 ? (
          <EmptyNote>No program enrollments recorded yet.</EmptyNote>
        ) : (
          <div className="space-y-3.5">
            {data.map((d, i) => {
              const pctOfMax = Math.round((d.value / max) * 100);
              const pctOfTotal = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
              const color = CHART_PALETTE[i % CHART_PALETTE.length];
              const isHovered = hoveredIdx === i;

              return (
                <div
                  key={d.label}
                  className="space-y-1.5 cursor-default transition-all"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={cn(
                        "font-semibold text-foreground truncate max-w-[280px]",
                        isHovered && "text-primary"
                      )}
                      title={d.label}
                    >
                      {d.label}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground text-[11px] font-medium">
                        {pctOfTotal}% share
                      </span>
                      <span className="font-bold tabular-nums text-foreground bg-muted/60 px-2 py-0.5 rounded-sm">
                        {d.value} students
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar with custom theme color */}
                  <div className="h-2.5 w-full rounded-full bg-muted/70 overflow-hidden relative">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        color.bg,
                        isHovered ? "opacity-100 ring-1 ring-offset-0" : "opacity-90"
                      )}
                      style={{ width: `${Math.max(pctOfMax, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** ── 2. Students per Semester Vertical Column Chart ── */
export function SemesterEnrollmentChart({
  title = "Active Enrollment by Semester",
  data,
}: {
  title?: string;
  data: BarDatum[];
}) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="rounded-xl border border-border/70 shadow-xs bg-card overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IconChartBar size={14} />
            </span>
            <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              {title}
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            {total} Active Students
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {data.length === 0 || max === 0 ? (
          <EmptyNote>No student semester data available.</EmptyNote>
        ) : (
          <div className="pt-4">
            <div className="flex h-44 items-end gap-2.5 sm:gap-3.5 px-2">
              {data.map((d) => {
                const heightPct = Math.round((d.value / max) * 100);
                const isHovered = hoveredLabel === d.label;

                return (
                  <div
                    key={d.label}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1.5 group cursor-default"
                    onMouseEnter={() => setHoveredLabel(d.label)}
                    onMouseLeave={() => setHoveredLabel(null)}
                  >
                    {/* Value Pill Above Column */}
                    <span
                      className={cn(
                        "text-[11px] font-bold tabular-nums transition-all duration-200",
                        isHovered
                          ? "text-primary scale-110 -translate-y-0.5"
                          : "text-muted-foreground"
                      )}
                    >
                      {d.value}
                    </span>

                    {/* Column Bar with Gradient */}
                    <div className="w-full relative flex items-end justify-center h-full">
                      <div
                        className={cn(
                          "w-full rounded-t-md transition-all duration-500",
                          isHovered
                            ? "bg-primary shadow-xs ring-1 ring-primary/40"
                            : "bg-primary/80 hover:bg-primary"
                        )}
                        style={{ height: `${Math.max(heightPct, 6)}%` }}
                      />
                    </div>

                    {/* Axis Label */}
                    <span
                      className={cn(
                        "text-[10px] font-semibold text-muted-foreground whitespace-nowrap transition-colors",
                        isHovered && "text-foreground font-bold"
                      )}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Undergraduate Semesters 1 through 8</span>
              <span className="font-semibold text-foreground">
                Peak: {data.find((d) => d.value === max)?.label ?? "—"} ({max} students)
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** ── 3. Student Lifecycle Donut Chart ── */
export function StudentLifecycleDonutCard({ data }: { data: LifecycleData }) {
  const total = data.active + data.graduated + data.dropped;
  const activeRate = total > 0 ? ((data.active / total) * 100).toFixed(0) : "0";

  const segments: Array<{
    key: keyof LifecycleData;
    label: string;
    color: string;
    badgeBg: string;
    description: string;
  }> = [
    {
      key: "active",
      label: "Active Learners",
      color: "#059669",
      badgeBg: "bg-emerald-500",
      description: "Enrolled & attending",
    },
    {
      key: "graduated",
      label: "Graduated Alumni",
      color: "#2563eb",
      badgeBg: "bg-blue-600",
      description: "Degrees conferred",
    },
    {
      key: "dropped",
      label: "Dropped / Inactive",
      color: "#e11d48",
      badgeBg: "bg-rose-500",
      description: "Discontinued",
    },
  ];

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Card className="rounded-xl border border-border/70 shadow-xs bg-card overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconUserCheck size={14} />
            </span>
            <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              Student Lifecycle &amp; Retention
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-muted/60">
            {total} Total Registered
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {total === 0 ? (
          <EmptyNote>No registered student records found.</EmptyNote>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            {/* SVG Donut with Center Text */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg viewBox="0 0 140 140" className="size-36 -rotate-90" aria-hidden="true">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  className="text-muted/40"
                  strokeWidth="16"
                />
                {segments.map((seg) => {
                  const value = data[seg.key];
                  if (value === 0) return null;
                  const fraction = value / total;
                  const dash = fraction * circumference;
                  const circleEl = (
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
                      className="transition-all duration-700"
                    />
                  );
                  offset += dash;
                  return circleEl;
                })}
              </svg>

              {/* Center Counter */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {activeRate}%
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Active
                </span>
              </div>
            </div>

            {/* Segment Legend Cards */}
            <div className="w-full sm:w-64 space-y-2.5">
              {segments.map((seg) => {
                const count = data[seg.key];
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";

                return (
                  <div
                    key={seg.key}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn("size-3 rounded-full shrink-0 shadow-2xs", seg.badgeBg)}
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{seg.label}</p>
                        <p className="text-[10px] text-muted-foreground">{seg.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold tabular-nums text-foreground">{count}</p>
                      <p className="text-[10px] text-muted-foreground">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** ── 4. Weekly Schedule Load (Teaching Sessions by Day) ── */
export function WeeklyTeachingLoadCard({ data }: { data: WeeklyDayDatum[] }) {
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="rounded-xl border border-border/70 shadow-xs bg-card overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconCalendar size={14} />
            </span>
            <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              Weekly Teaching Load Distribution
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            {total} Total Sessions / Week
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {data.length === 0 || max === 0 ? (
          <EmptyNote>No scheduled timetable slots found.</EmptyNote>
        ) : (
          <div className="grid grid-cols-5 gap-2 sm:gap-3 text-center">
            {data.map((d) => {
              const heightPct = Math.round((d.count / max) * 100);

              return (
                <div key={d.day} className="flex flex-col items-center justify-end h-32 gap-1.5">
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    {d.count}
                  </span>
                  <div className="w-full flex items-end justify-center h-20 bg-muted/30 rounded-t-md overflow-hidden">
                    <div
                      className="w-full rounded-t-md bg-primary/85 transition-all duration-500"
                      style={{ height: `${Math.max(heightPct, 8)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {d.shortDay}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

