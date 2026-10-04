"use client";

import type { CSSProperties, MouseEvent } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  WORK_DAYS,
  layoutDay,
  colorIndexFor,
  PALETTE,
  weekRange,
  timeToMinutes,
  minutesToHHMM,
  formatTime,
  ROW_H,
  SLOT_MARGIN,
} from "@/app/lib/timetable-layout";
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
   * hatched "Break" band across every day row. It is NOT an item: no class
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
  const normalized = items.map((item) => ({
    ...item,
    startMin: timeToMinutes(item.startTime) ?? 9 * 60,
    endMin: timeToMinutes(item.endTime) ?? 10 * 60 + 30,
    color: PALETTE[colorIndexFor(item.subject.code)],
  }));

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
      b.subjectTeacherName ? b.subjectTeacherName : "",
      b.type === "Practical" ? "Practical" : "Lecture",
      `${formatTime(b.startTime)} – ${formatTime(b.endTime)}`,
      b.conflict ? "⚠ Overlapping slots" : "",
    ]
      .filter(Boolean)
      .join("\n");

  const gridBackground = `repeating-linear-gradient(to right, color-mix(in oklab, var(--border) 60%, transparent) 0px, color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px, transparent ${halfHourPeriod}), repeating-linear-gradient(to right, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPeriod})`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative min-w-190">
        {/* Time axis header */}
        <div className="flex">
          <div className="w-14 shrink-0" />
          <div className="relative h-9 flex-1 border-b border-border">
            {timeMarks.map((m) => {
              const isHour = m % 60 === 0;
              return (
                <span
                  key={m}
                  className={cn(
                    "absolute bottom-1 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums",
                    !isHour && "text-muted-foreground/60",
                  )}
                  style={{ left: `${((m - dayStart) / gridMinutes) * 100}%` }}
                >
                  {minutesToHHMM(m)}
                </span>
              );
            })}
          </div>
        </div>

        {/* One row per weekday. Weekends (Sat/Sun) are omitted — no classes. */}
        {WORK_DAYS.map((day) => {
          const dayBlocks = normalized.filter((b) => b.dayOfWeek === day);
          const laid = layoutDay(dayBlocks);
          const hint = readonly ? "" : trackHint?.(day) ?? `Click to schedule a ${day.toLowerCase()} class`;

          return (
            <div key={day} className="flex border-b border-border/60 last:border-b-0" style={{ height: ROW_H }}>
              <div className="flex w-14 shrink-0 flex-col justify-center px-2">
                <span className="text-xs font-semibold text-muted-foreground">{day.slice(0, 3)}</span>
              </div>
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
                {breakPeriod && breakActive && (
                  <div
                    className={cn(
                      "absolute inset-y-1 z-1 flex items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30",
                      !readonly && onBreakClick && "cursor-pointer hover:border-ring/60",
                    )}
                    title={!readonly && onBreakClick ? "Click to edit the break" : undefined}
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
                      backgroundImage:
                        "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0px, color-mix(in oklab, var(--muted-foreground) 14%, transparent) 1.5px, transparent 1.5px, transparent 7px)",
                    }}
                  >
                    <span className="rounded-sm border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                      Break
                    </span>
                  </div>
                )}

                {laid.map((b) => {
                  const blockStyle = {
                    // Centered inside its time span with an equal SLOT_MARGIN
                    // inset on all four sides (top/bottom come from layoutDay).
                    left: `calc(${((b.startMin - dayStart) / gridMinutes) * 100}% + ${SLOT_MARGIN}px)`,
                    width: `calc(${((b.endMin - b.startMin) / gridMinutes) * 100}% - ${SLOT_MARGIN * 2}px)`,
                    top: b.top,
                    height: b.height,
                    borderLeftColor: b.color,
                    background: `linear-gradient(to right, color-mix(in oklab, ${b.color} 15%, transparent), color-mix(in oklab, ${b.color} 7%, transparent))`,
                  } as CSSProperties;

                  // The slot's time is already expressed by its position on the
                  // grid (and precisely in the hover tooltip), so no time text
                  // inside the block. The subject NAME is the primary line and
                  // the code/type/group are secondary.
                  const inner = (
                    <>
                      <strong className="flex items-start gap-1 text-[12px] leading-snug font-semibold">
                        <span className="min-w-0 flex-1 truncate">{b.subject.name}</span>
                        {b.conflict && (
                          <IconAlertTriangle
                            size={12}
                            className="mt-px shrink-0 text-destructive"
                            aria-hidden="true"
                          />
                        )}
                      </strong>
                      {!b.sm && (
                        <span className="mt-0.5 block truncate text-[10px] leading-tight opacity-70">
                          {b.subject.code}
                          {b.type === "Practical" ? " · Lab" : ""}
                          {b.group ? ` · ${b.group}` : ""}
                        </span>
                      )}
                    </>
                  );

                  const blockClasses = cn(
                    "absolute z-[2] overflow-hidden rounded-md border border-border/60 border-l-[3px] px-2 py-1 text-left text-foreground shadow-sm transition-shadow",
                    !readonly && "cursor-pointer hover:z-[3] hover:shadow-md",
                    b.conflict && "ring-2 ring-destructive/50",
                  );

                  if (readonly) {
                    return (
                      <div key={b.id} className={blockClasses} style={blockStyle} title={blockTip(b)}>
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
