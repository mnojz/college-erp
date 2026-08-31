"use client";

import type { MouseEvent } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  LUNCH_DAYS,
  WORK_DAYS,
  layoutDay,
  colorIndexFor,
  PALETTE,
  weekRange,
  timeToMinutes,
  minutesToHHMM,
  formatTime,
  ROW_H,
} from "@/app/lib/timetable-layout";

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
  /** Render non-interactive blocks (student view). */
  readonly?: boolean;
  /** Optional fixed time window (minutes-since-midnight); auto-computed otherwise. */
  dayStart?: number | null;
  dayEnd?: number | null;
  onTrackClick?: (day: string, minutes: number, e: MouseEvent<HTMLDivElement>) => void;
  onBlockClick?: (item: TimetableItem) => void;
  /** Click on the lunch-break overlay (admin editor). Ignored for read-only. */
  onLunchClick?: (item: TimetableItem) => void;
  /** Tooltip shown on the (clickable) day track; ignored for read-only. */
  trackHint?: (day: string) => string;
};

/**
 * Week timetable grid shared by the admin editor (interactive) and the
 * student schedule view (read-only). Uses the shared layoutDay geometry:
 * a single block fills the whole slot; two blocks split it with a tiny gap.
 */
export function TimetableGrid({
  items,
  readonly = false,
  dayStart: dayStartProp = null,
  dayEnd: dayEndProp = null,
  onTrackClick,
  onBlockClick,
  onLunchClick,
  trackHint,
}: TimetableGridProps) {
  const normalized = items.map((item) => ({
    ...item,
    startMin: timeToMinutes(item.startTime) ?? 9 * 60,
    endMin: timeToMinutes(item.endTime) ?? 10 * 60 + 30,
    color: PALETTE[colorIndexFor(item.subject.code)],
  }));

  // The lunch break is stored like any other class slot (one per table).
  const lunchItem = normalized.find((i) => i.type === "Lunch") ?? null;
  const lunch = lunchItem ? { start: lunchItem.startTime, end: lunchItem.endTime } : null;

  const range = weekRange(normalized, lunch);
  const dayStart = dayStartProp ?? range.dayStart;
  const dayEnd = dayEndProp ?? range.dayEnd;
  const gridMinutes = Math.max(60, dayEnd - dayStart);
  const hourPeriod = `${(60 / gridMinutes) * 100}%`;
  const halfHourPeriod = `${(30 / gridMinutes) * 100}%`;

  // 30-minute axis marks.
  const timeMarks: number[] = [];
  for (let m = Math.floor(dayStart / 30) * 30; m <= dayEnd; m += 30) timeMarks.push(m);

  const lunchStartMin = lunch ? timeToMinutes(lunch.start) : null;
  const lunchEndMin = lunch ? timeToMinutes(lunch.end) : null;
  const lunchActive =
    lunchStartMin !== null && lunchEndMin !== null && lunchEndMin > lunchStartMin;
// Shared tooltip for a class block (identical in admin + student views).
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
return (
    <div className="tt-scroll">
      <div className="tt-inner">
        {/* Time axis header */}
        <div className="tt-row tt-head-row">
          <div className="tt-corner" />
          <div className="tt-axis-x">
            {timeMarks.map((m) => {
              const isHour = m % 60 === 0;
              return (
                <span
                  key={m}
                  className={`tt-hour${isHour ? "" : " tt-hour-half"}${
                    m === dayStart ? " tt-hour-first" : ""
                  }${m === timeMarks[timeMarks.length - 1] ? " tt-hour-last" : ""}`}
                  style={{ left: `${((m - dayStart) / gridMinutes) * 100}%` }}
                >
                  {minutesToHHMM(m)}
                </span>
              );
            })}
          </div>
        </div>

        {/* One row per weekday */}
        {WORK_DAYS.map((day) => {
          const dayBlocks = normalized.filter((b) => b.dayOfWeek === day && b.type !== "Lunch");
          const laid = layoutDay(dayBlocks);
          const isLunchDay = (LUNCH_DAYS as readonly string[]).includes(day);
          const hint = readonly
            ? ""
            : trackHint?.(day) ?? `Click to schedule a ${day.toLowerCase()} class`;

          return (
            <div key={day} className="tt-row" style={{ height: ROW_H }}>
              <div className="tt-day-cell">{day.slice(0, 3)}</div>
              <div
                className={`tt-day-track${readonly ? " tt-day-track-readonly" : ""}`}
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, var(--line-faint) 0px, var(--line-faint) 1px, transparent 1px, transparent ${halfHourPeriod}), repeating-linear-gradient(to right, var(--line) 0px, var(--line) 1px, transparent 1px, transparent ${hourPeriod})`,
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
                {lunchItem && lunchActive && isLunchDay && (
                  <div
                    className={`tt-lunch${
                      !readonly && onLunchClick ? " tt-lunch-interactive" : ""
                    }`}
                    title={
                      !readonly && onLunchClick ? "Click to edit the lunch break" : undefined
                    }
                    onClick={
                      readonly || !onLunchClick || !lunchItem
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            onLunchClick(lunchItem);
                          }
                    }
                    style={{
                      left: `${((lunchStartMin! - dayStart) / gridMinutes) * 100}%`,
                      width: `${((lunchEndMin! - lunchStartMin!) / gridMinutes) * 100}%`,
                    }}
                  >
                    <span>Lunch</span>
                  </div>
                )}

                {laid.map((b) => {
                  const blockStyle = {
                    left: `${((b.startMin - dayStart) / gridMinutes) * 100}%`,
                    width: `calc(${((b.endMin - b.startMin) / gridMinutes) * 100}% - 6px)`,
                    top: b.top,
                    height: b.height,
                    borderLeftColor: b.color,
                    background: `linear-gradient(to right, ${b.color}26, ${b.color}12)`,
                  } as React.CSSProperties;

                  const inner = (
                    <>
                      <strong className="tt-block-title">
                        <span>
                          {b.subject.code}
                          {b.type === "Practical" ? " · Lab" : ""}
                        </span>
                        {b.conflict && (
                          <IconAlertTriangle size={11} className="tt-block-warn" aria-hidden="true" />
                        )}
                      </strong>
                      <span className="tt-block-name">
                        {b.group ? `${b.group} · ${b.subject.name}` : b.subject.name}
                      </span>
                    </>
                  );

                  if (readonly) {
                    return (
                      <div
                        key={b.id}
                        className={`tt-block tt-block-readonly${b.sm ? " tt-block-sm" : ""}${
                          b.conflict ? " tt-block-conflict" : ""
                        }`}
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
                      className={`tt-block${b.sm ? " tt-block-sm" : ""}${
                        b.conflict ? " tt-block-conflict" : ""
                      }`}
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