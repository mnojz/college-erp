// ─── Shared timetable geometry & helpers ──────────────────────────────
// Used by the admin timetable editor and the (read-only) student schedule
// view so both render identically.
//
// Slot geometry rules:
//  - A day row is one "slot" tall (ROW_H).
//  - 1 block in a slot → it stretches to fill the whole slot (minus margins).
//  - 2 blocks in a slot → they share the slot, each half the height, with a
//    tiny gap between them so they never touch.
//  - More than 2 overlapping blocks (rare) fall back to tighter lane stacking.

export const WORK_DAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

// Lunch is rendered Monday–Friday only.
export const LUNCH_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

export const ROW_H = 84; // day-row (= slot) height in px
export const SLOT_MARGIN = 4; // px between a block and the row edge
export const SLOT_GAP = 6; // px gap between two stacked blocks in one slot

export const FALLBACK_START = 9 * 60;
export const FALLBACK_END = 15 * 60;

export const PALETTE = [
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** "HH:MM" or ISO/date string → minutes since midnight (or null). */
export function timeToMinutes(value: string): number | null {
  const m = TIME_RE.exec(value);
  if (m) {
    const mins = Number(m[1]) * 60 + Number(m[2]);
    return mins >= 0 && mins < 24 * 60 ? mins : null;
  }
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  } catch {
    return null;
  }
}

export function minutesToHHMM(totalMinutes: number) {
  const m = Math.max(0, Math.min(24 * 60 - 30, totalMinutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** ISO/date or "HH:MM" → 12-hour display clock. */
export function formatTime(value: string) {
  const mins = timeToMinutes(value);
  if (mins === null) return value;
  const d = new Date(0);
  d.setUTCHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function colorIndexFor(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return hash % PALETTE.length;
}

export type LayoutBlock<T extends { startMin: number; endMin: number }> = T & {
  top: number;
  height: number;
  sm: boolean; // true → render with the compact (small) block style
};

/**
 * Lay out one weekday's blocks inside the slot.
 * Blocks overlapping in time share the slot (max 2 expected); a lone block
 * stretches to fill it.
 */
export function layoutDay<T extends { startMin: number; endMin: number }>(
  blocks: T[],
): Array<LayoutBlock<T>> {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Group blocks into clusters connected by time overlap.
  const clusters: T[][] = [];
  for (const b of sorted) {
    const target = clusters.find((c) =>
      c.some((x) => x.startMin < b.endMin && b.startMin < x.endMin),
    );
    if (target) target.push(b);
    else clusters.push([b]);
  }

  const result: Array<LayoutBlock<T>> = [];
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      const b = cluster[0];
      // One block in the slot → stretch to fill the whole row.
      result.push({ ...b, top: SLOT_MARGIN, height: ROW_H - 2 * SLOT_MARGIN, sm: false });
      continue;
    }
    if (cluster.length === 2) {
      // Two blocks in the slot → split it perfectly (with a small gap).
      const h = (ROW_H - 2 * SLOT_MARGIN - SLOT_GAP) / 2;
      cluster.forEach((b, i) => {
        result.push({
          ...b,
          top: Math.round(SLOT_MARGIN + i * (h + SLOT_GAP)),
          height: Math.round(h),
          sm: true,
        });
      });
      continue;
    }
    // Rare: three or more overlapping blocks — fall back to lane stacking.
    const pitch = 26;
    cluster.forEach((b, i) => {
      result.push({
        ...b,
        top: Math.round(SLOT_MARGIN + i * pitch),
        height: pitch - SLOT_GAP,
        sm: true,
      });
    });
  }
  return result;
}

/** Week time-window (floored/ceil hour bounds) covering every block + lunch. */
export function weekRange(
  items: Array<{ startMin: number; endMin: number }>,
  lunch?: { start: string; end: string } | null,
) {
  const starts: number[] = items.map((i) => i.startMin);
  const ends: number[] = items.map((i) => i.endMin);
  const ls = lunch ? timeToMinutes(lunch.start) : null;
  const le = lunch ? timeToMinutes(lunch.end) : null;
  if (ls !== null) starts.push(ls);
  if (le !== null) ends.push(le);

  const dayStart = starts.length === 0 ? FALLBACK_START : Math.floor(Math.min(...starts) / 60) * 60;
  const dayEnd = ends.length === 0 ? FALLBACK_END : Math.ceil(Math.max(...ends) / 60) * 60;
  return { dayStart, dayEnd, gridMinutes: Math.max(60, dayEnd - dayStart) };
}