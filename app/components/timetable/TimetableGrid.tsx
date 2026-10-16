"use client";

import { useMemo, type CSSProperties, type MouseEvent } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  WORK_DAYS,
  layoutDay,
  buildSubjectColorMap,
  getColorForSubject,
  weekRange,
  timeToMinutes,
  formatTime,
  ROW_H,
  SLOT_MARGIN,
} from "@/app/lib/timetable-layout";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export type TimetableItem = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type?: string | null;
  group?: string | null;
  subject: { name: string; code: string };
  /** Pre-formatted teacher line used in the block tooltip. */
  subjectTeacherName?: string;
  conflict?: boolean;
};

export type TimetableGridProps = {
  items: TimetableItem[];
  /**
   * The timetable's break window (Break model), if set — rendered as the
   * "Break" band across every day row. It is NOT an item: no class
   * can overlap it (enforced server-side).
   */
  breakPeriod?: { start: string; end: string } | null;
  /** Render non-interactive blocks (student view). */
  readonly?: boolean;
  /** Optional fixed time window (minutes-since-midnight); auto-computed otherwise. */
  dayStart?: number | null;
  dayEnd?: number | null;
  onTrackClick?: (day: string, minutes: number, e: MouseEvent<HTMLDivElement>) => void;
  onBlockClick?: (item: TimetableItem) => void;
  /** Click on the break overlay (admin editor). Ignored for read-only. */
  onBreakClick?: () => void;
  /** Tooltip shown on the (clickable) day track; ignored for read-only. */
  trackHint?: (day: string) => string;
};

function formatAxisTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${displayH} ${ampm}`;
  return `${displayH}:${String(m).padStart(2, "0")}`;
}

export function TimetableGrid({
  items,
  breakPeriod = null,
  readonly = false,
  dayStart: dayStartProp = null,
  dayEnd: dayEndProp = null,
  onTrackClick,
  onBlockClick,
  onBreakClick,
  trackHint,
}: TimetableGridProps) {
  const todayDayName = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase(),
    []
  );

  // Deterministically assign unique colors to distinct subjects in this timetable (NO REPEATS)
  const colorMap = useMemo(() => {
    const codes = items.map((i) => i.subject.code);
    return buildSubjectColorMap(codes);
  }, [items]);

  const normalized = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        startMin: timeToMinutes(item.startTime) ?? 9 * 60,
        endMin: timeToMinutes(item.endTime) ?? 10 * 60 + 30,
        colorTheme: colorMap.get(item.subject.code) ?? getColorForSubject(item.subject.code),
      })),
    [items, colorMap]
  );

  const range = weekRange(normalized, breakPeriod);
  const dayStart = dayStartProp ?? range.dayStart;
  const dayEnd = dayEndProp ?? range.dayEnd;
  const gridMinutes = Math.max(60, dayEnd - dayStart);
  const hourPeriod = `${(60 / gridMinutes) * 100}%`;
  const halfHourPeriod = `${(30 / gridMinutes) * 100}%`;

  const timeMarks: number[] = [];
  for (let m = Math.floor(dayStart / 30) * 30; m <= dayEnd; m += 30) timeMarks.push(m);

  const breakStartMin = breakPeriod ? timeToMinutes(breakPeriod.start) : null;
  const breakEndMin = breakPeriod ? timeToMinutes(breakPeriod.end) : null;
  const breakActive =
    breakStartMin !== null && breakEndMin !== null && breakEndMin > breakStartMin;

  const blockTip = (b: (typeof normalized)[number]) =>
    [
      `${b.subject.code} · ${b.subject.name}`,
      b.group ? `Group ${b.group}` : "",
      b.subjectTeacherName ? `Teacher: ${b.subjectTeacherName}` : "",
      b.type === "Practical" ? "Type: Practical / Lab" : "Type: Lecture",
      `Time: ${formatTime(b.startTime)} – ${formatTime(b.endTime)}`,
      b.conflict ? "⚠ WARNING: Overlapping class slots" : "",
    ]
      .filter(Boolean)
      .join("\n");

  const gridBackground = `repeating-linear-gradient(to right, color-mix(in oklab, var(--border) 35%, transparent) 0px, color-mix(in oklab, var(--border) 35%, transparent) 1px, transparent 1px, transparent ${halfHourPeriod}), repeating-linear-gradient(to right, color-mix(in oklab, var(--border) 80%, transparent) 0px, color-mix(in oklab, var(--border) 80%, transparent) 1px, transparent 1px, transparent ${hourPeriod})`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative min-w-[760px]">
        {/* Time axis header */}
        <div className="flex border-b border-border/80 pb-1.5">
          <div className="w-20 sm:w-24 shrink-0 text-left px-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Day
            </span>
          </div>
          <div className="relative h-7 flex-1">
            {timeMarks.map((m) => {
              const isHour = m % 60 === 0;
              return (
                <span
                  key={m}
                  className={cn(
                    "absolute bottom-0.5 -translate-x-1/2 font-mono tabular-nums transition-colors",
                    isHour
                      ? "text-xs font-bold text-foreground"
                      : "text-[11px] font-medium text-muted-foreground/70",
                  )}
                  style={{ left: `${((m - dayStart) / gridMinutes) * 100}%` }}
                >
                  {formatAxisTime(m)}
                </span>
              );
            })}
          </div>
        </div>

        {/* Weekday rows */}
        {WORK_DAYS.map((day) => {
          const isToday = todayDayName === day;
          const dayBlocks = normalized.filter((b) => b.dayOfWeek === day);
          const laid = layoutDay(dayBlocks);
          const hint = readonly ? "" : trackHint?.(day) ?? `Click to schedule a ${day.toLowerCase()} class`;

          return (
            <div
              key={day}
              className={cn(
                "flex border-b border-border/60 last:border-b-0 transition-colors",
                isToday ? "bg-primary/[0.02]" : ""
              )}
              style={{ height: ROW_H }}
            >
              {/* Day Label Column */}
              <div
                className={cn(
                  "flex w-20 sm:w-24 shrink-0 flex-col justify-center px-2.5 py-1.5 border-r border-border/60",
                  isToday ? "bg-primary/[0.04]" : "bg-muted/10"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-bold uppercase tracking-wider",
                      isToday ? "text-primary font-extrabold" : "text-foreground"
                    )}
                  >
                    {day.slice(0, 3)}
                  </span>
                  {isToday && (
                    <Badge
                      variant="outline"
                      className="text-[9px] font-extrabold px-1 py-0 bg-primary/15 text-primary border-transparent"
                    >
                      TODAY
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground hidden sm:block capitalize">
                  {day.toLowerCase()}
                </span>
              </div>

              {/* Day Track Column */}
              <div
                className={cn("relative flex-1", !readonly && "cursor-crosshair")}
                style={{
                  backgroundImage: gridBackground,
                }}
                title={hint || undefined}
                onClick={
                  readonly || !onTrackClick
                    ? undefined
                    : (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = (e.clientX - rect.left) / rect.width;
                        let minutes = dayStart + Math.round((ratio * gridMinutes) / 30) * 30;
                        minutes = Math.max(dayStart, Math.min(dayEnd - 60, minutes));
                        onTrackClick(day, minutes, e);
                      }
                }
              >
                {/* Neutral Grayish Break Band */}
                {breakPeriod && breakActive && (
                  <div
                    className={cn(
                      "absolute inset-y-1 z-1 flex items-center justify-center rounded-md border border-border/80 bg-muted/60 dark:bg-muted/40 transition-colors",
                      !readonly && onBreakClick && "cursor-pointer hover:border-ring/60",
                    )}
                    title={
                      !readonly && onBreakClick
                        ? "Click to edit break schedule"
                        : `Break (${formatTime(breakPeriod.start)} – ${formatTime(breakPeriod.end)})`
                    }
                    onClick={
                      readonly || !onBreakClick
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            onBreakClick();
                          }
                    }
                    style={{
                      left: `calc(${((breakStartMin! - dayStart) / gridMinutes) * 100}% + ${SLOT_MARGIN}px)`,
                      width: `calc(${((breakEndMin! - breakStartMin!) / gridMinutes) * 100}% - ${SLOT_MARGIN * 2}px)`,
                    }}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground select-none">
                      Break
                    </span>
                  </div>
                )}

                {/* Class Blocks */}
                {laid.map((b) => {
                  const color = b.colorTheme;
                  const isLab = b.type === "Practical";
                  const isSmall = b.sm || b.height < 50 || (b.endMin - b.startMin) <= 45;

                  const blockStyle = {
                    left: `calc(${((b.startMin - dayStart) / gridMinutes) * 100}% + ${SLOT_MARGIN}px)`,
                    width: `calc(${((b.endMin - b.startMin) / gridMinutes) * 100}% - ${SLOT_MARGIN * 2}px)`,
                    top: b.top,
                    height: b.height,
                    borderLeftColor: color.border,
                    backgroundColor: color.bg,
                    ...(isLab && isSmall
                      ? {
                          borderColor: color.border,
                          boxShadow: `0 0 0 1px ${color.border}, 0 0 10px 1.5px ${color.border}80`,
                        }
                      : {}),
                  } as CSSProperties;

                  const inner = isSmall ? (
                    <div className="flex items-center justify-between h-full w-full overflow-hidden select-none px-1">
                      <span
                        className="font-bold text-foreground leading-snug line-clamp-2 text-xs truncate"
                        title={b.subject.name}
                      >
                        {b.subject.name}
                      </span>
                      {b.conflict && (
                        <IconAlertTriangle
                          size={13}
                          className="shrink-0 text-destructive ml-1"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center h-full w-full overflow-hidden select-none px-0.5">
                      {/* Subject Name - Big, Bold & Clear */}
                      <div className="flex items-start gap-1">
                        <span
                          className="font-bold text-foreground leading-snug line-clamp-2 text-xs sm:text-[13px]"
                          title={b.subject.name}
                        >
                          {b.subject.name}
                        </span>
                        {b.conflict && (
                          <IconAlertTriangle
                            size={14}
                            className="shrink-0 text-destructive mt-0.5"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      {/* Secondary row: Code & Type / Group */}
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground font-medium">
                        <span className="font-mono font-bold text-foreground/80">
                          {b.subject.code}
                        </span>
                        {isLab && (
                          <Badge className="text-[10px] font-bold py-0 px-1 border-0 bg-purple-500/15 text-purple-700 dark:text-purple-400">
                            Lab
                          </Badge>
                        )}
                        {b.group && (
                          <span className="text-[10px] text-muted-foreground">
                            · Grp {b.group}
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  const blockClasses = cn(
                    "absolute z-[2] overflow-hidden rounded-md border border-border/80 border-l-[3.5px] px-2.5 py-1.5 text-left shadow-2xs transition-all",
                    !readonly && "cursor-pointer hover:z-[3] hover:shadow-md hover:border-border",
                    b.conflict && "ring-2 ring-destructive/60",
                  );

                  if (readonly) {
                    return (
                      <div
                        key={b.id}
                        className={blockClasses}
                        style={blockStyle}
                        title={blockTip(b)}
                      >
                        {inner}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={blockClasses}
                      style={blockStyle}
                      title={blockTip(b)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBlockClick?.(b);
                      }}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
