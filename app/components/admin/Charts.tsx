"use client";

import { useMemo, useState } from "react";
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

/** ── 4. Weekly Schedule Load (Smooth Curve Area Graph) ── */
export function WeeklyTeachingLoadCard({ data }: { data: WeeklyDayDatum[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);

  // SVG dimensions
  const svgWidth = 500;
  const svgHeight = 210;
  const padX = 45;
  const padTop = 32;
  const bottomY = 160;
  const chartHeight = bottomY - padTop; // 128

  // Headroom for peak so the curve crowns gracefully without clipping
  const scaleMax = max > 0 ? Math.max(max * 1.25, max + 2) : 10;

  function formatDay(str: string) {
    if (!str) return "";
    const clean = str.slice(0, 3);
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  // Calculate coordinates for each point
  const points: Array<{ x: number; y: number; data: WeeklyDayDatum; index: number }> =
    useMemo(() => {
      return data.map((d, i) => {
        const x =
          data.length > 1
            ? padX + (i * (svgWidth - 2 * padX)) / (data.length - 1)
            : svgWidth / 2;
        const ratio = scaleMax > 0 ? d.count / scaleMax : 0;
        const y = bottomY - ratio * chartHeight;
        return { x, y, data: d, index: i };
      });
    }, [data, scaleMax, bottomY, chartHeight]);

  // Catmull-Rom to Cubic Bezier curve path generator
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    return points.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      const prev2 = arr[i - 2] ?? arr[i - 1];
      const prev1 = arr[i - 1];
      const next1 = arr[i + 1] ?? pt;

      const cp1x = prev1.x + (pt.x - prev2.x) / 6;
      const cp1y = Math.min(Math.max(prev1.y + (pt.y - prev2.y) / 6, padTop - 5), bottomY);

      const cp2x = pt.x - (next1.x - prev1.x) / 6;
      const cp2y = Math.min(Math.max(pt.y - (next1.y - prev1.y) / 6, padTop - 5), bottomY);

      return `${acc} C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }, "");
  }, [points, padTop, bottomY]);

  // Closed area path for the gradient background
  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${linePath} L ${lastX.toFixed(1)},${bottomY} L ${firstX.toFixed(1)},${bottomY} Z`;
  }, [linePath, points, bottomY]);

  // Horizontal grid lines
  const gridSteps = [0.25, 0.5, 0.75, 1];

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <Card className="rounded-xl border border-border/70 shadow-xs bg-card overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <IconCalendar size={14} />
            </span>
            <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground">
              Weekly Teaching Load Distribution
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
              Weekly View
            </span>
            <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-background/80 text-foreground">
              {total} Total Sessions
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {data.length === 0 || max === 0 ? (
          <EmptyNote>No scheduled timetable slots found.</EmptyNote>
        ) : (
          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                {/* Semi-transparent cyan gradient fill */}
                <linearGradient id="teachingLoadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                  <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>

                {/* Subtle curve glow filter */}
                <filter id="curveGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Horizontal Grid lines */}
              {gridSteps.map((step, idx) => {
                const y = bottomY - step * chartHeight;
                return (
                  <line
                    key={idx}
                    x1={padX - 10}
                    y1={y}
                    x2={svgWidth - padX + 10}
                    y2={y}
                    stroke="currentColor"
                    className="text-border/40"
                    strokeWidth="1"
                    strokeDasharray={step < 1 ? "4 4" : undefined}
                  />
                );
              })}

              {/* Baseline */}
              <line
                x1={padX - 10}
                y1={bottomY}
                x2={svgWidth - padX + 10}
                y2={bottomY}
                stroke="currentColor"
                className="text-border/60"
                strokeWidth="1"
              />

              {/* Area under curve with semi-transparent gradient */}
              <path
                d={areaPath}
                fill="url(#teachingLoadGradient)"
                className="transition-all duration-300"
              />

              {/* Glow backdrop path */}
              <path
                d={linePath}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="6"
                strokeOpacity="0.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#curveGlow)"
              />

              {/* Crisp foreground smooth curve */}
              <path
                d={linePath}
                fill="none"
                className="stroke-cyan-500 dark:stroke-cyan-400"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Vertical Guide line on hover */}
              {activePoint && (
                <line
                  x1={activePoint.x}
                  y1={padTop}
                  x2={activePoint.x}
                  y2={bottomY}
                  stroke="currentColor"
                  className="text-cyan-500/50 dark:text-cyan-400/50"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}

              {/* Data points & hit targets */}
              {points.map((pt) => {
                const isHovered = hoveredIdx === pt.index;

                return (
                  <g key={pt.data.day} className="cursor-pointer">
                    {/* Invisible larger hit target for smooth hover interactions */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="18"
                      fill="transparent"
                      onMouseEnter={() => setHoveredIdx(pt.index)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    />

                    {/* Outer glow ring when hovered */}
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="9"
                        className="fill-cyan-500/20 stroke-cyan-400"
                        strokeWidth="2"
                      />
                    )}

                    {/* Outer node circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5.5 : 4.5}
                      className={cn(
                        "fill-card transition-all duration-150",
                        isHovered
                          ? "stroke-cyan-400"
                          : "stroke-cyan-600 dark:stroke-cyan-400"
                      )}
                      strokeWidth="2.5"
                    />

                    {/* Inner center dot */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 2.5 : 2}
                      className="fill-cyan-600 dark:fill-cyan-400"
                    />

                    {/* X-axis Day Label */}
                    <text
                      x={pt.x}
                      y={bottomY + 22}
                      textAnchor="middle"
                      className={cn(
                        "text-[11px] font-semibold transition-colors duration-150 select-none",
                        isHovered
                          ? "fill-cyan-600 dark:fill-cyan-400 font-bold"
                          : "fill-muted-foreground"
                      )}
                      onMouseEnter={() => setHoveredIdx(pt.index)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      {formatDay(pt.data.shortDay || pt.data.day)}
                    </text>
                  </g>
                );
              })}

              {/* Floating Tooltip Pill on Hover */}
              {activePoint && (
                <g
                  transform={`translate(${activePoint.x}, ${Math.max(activePoint.y - 28, 14)})`}
                  className="pointer-events-none transition-all duration-150"
                >
                  <rect
                    x="-34"
                    y="-12"
                    width="68"
                    height="24"
                    rx="12"
                    className="fill-foreground text-background shadow-md"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    className="fill-background text-[11px] font-bold"
                  >
                    {activePoint.data.count} {activePoint.data.count === 1 ? "class" : "classes"}
                  </text>
                </g>
              )}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

