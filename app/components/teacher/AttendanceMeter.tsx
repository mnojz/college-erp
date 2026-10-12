/**
 * Subject-scoped attendance meter for a roster row: `present/total` on the
 * left, a colored bar in the middle, the percentage on the right.
 *
 * The fill color is a continuous blend of the theme's catppuccin green and
 * red via `color-mix(… in oklab)`: 0% is pure red, 100% is pure green, and
 * the midpoint is the exact center of the blend — neighboring rates shift
 * smoothly instead of jumping at a threshold.
 */

/** 0% → pure ctp-red · 50% → exact mid-gradient · 100% → pure ctp-green. */
export function attendanceColor(rate: number): string {
  const p = Math.min(100, Math.max(0, rate));
  return `color-mix(in oklab, var(--ctp-green) ${p}%, var(--ctp-red) ${100 - p}%)`;
}

type AttendanceMeterProps = {
  /** PRESENT sessions counted for the student. */
  present: number;
  /** Sessions held for the class so far. */
  total: number;
};

/**
 * Fixed-width (no flex growth): every row's bar must be the same length so
 * rates stay visually comparable down the roster. The name absorbs slack.
 */
export function AttendanceMeter({ present, total }: AttendanceMeterProps) {
  const hasHistory = total > 0;
  // Clamp so inconsistent data can never push the bar (or its color) past 100%.
  const rate = hasHistory ? Math.min(100, Math.max(0, (present / total) * 100)) : 0;
  const percent = hasHistory ? `${Math.round(rate)}%` : "—";

  return (
    <div
      className="flex shrink-0 items-center gap-3"
      title={
        hasHistory
          ? `Present ${present} of ${total} sessions (${percent})`
          : "No attendance sessions held for this class yet"
      }
    >
      {/* Fixed widths keep the numeric columns aligned down the roster. */}
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {hasHistory ? `${present}/${total}` : "—/0"}
      </span>
      <div className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${rate}%`,
            background: hasHistory ? attendanceColor(rate) : "transparent",
          }}
        />
      </div>
      <span
        className={`w-11 shrink-0 text-right text-xs font-semibold tabular-nums ${
          hasHistory ? "" : "text-muted-foreground"
        }`}
        style={hasHistory ? { color: attendanceColor(rate) } : undefined}
      >
        {percent}
      </span>
    </div>
  );
}
