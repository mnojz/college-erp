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

// Weekday rows rendered on the timetable grid. Derived from TEACHING_DAYS so
// the grid, the admin day dropdowns and the /api/classes validator can never
// disagree about which days are taught.
export { TEACHING_DAYS as WORK_DAYS } from "@/app/lib/teaching-days";

export const ROW_H = 84; // day-row (= slot) height in px
export const SLOT_MARGIN = 4; // px between a block and the row edge
export const SLOT_GAP = 6; // px gap between two stacked blocks in one slot

export const FALLBACK_START = 9 * 60;
export const FALLBACK_END = 15 * 60;

export type TimetableColorTheme = {
  id: string;
  name: string;
  border: string; // Vibrant accent border
  bg: string;     // Semi-transparent comfortable background
  hoverBg: string;
  badgeBg: string;
  badgeText: string;
  accent: string;
};

/**
 * Modern, high-contrast palette for timetable blocks.
 * Designed with solid borders and comfortable contrast in both light and dark mode.
 */
export const COLOR_PALETTE: TimetableColorTheme[] = [
  {
    id: "indigo",
    name: "Indigo",
    border: "#4f46e5",
    bg: "rgba(79, 70, 229, 0.09)",
    hoverBg: "rgba(79, 70, 229, 0.16)",
    badgeBg: "rgba(79, 70, 229, 0.16)",
    badgeText: "#4338ca",
    accent: "#6366f1",
  },
  {
    id: "emerald",
    name: "Emerald",
    border: "#059669",
    bg: "rgba(5, 150, 105, 0.09)",
    hoverBg: "rgba(5, 150, 105, 0.16)",
    badgeBg: "rgba(5, 150, 105, 0.16)",
    badgeText: "#047857",
    accent: "#10b981",
  },
  {
    id: "amber",
    name: "Amber",
    border: "#d97706",
    bg: "rgba(217, 119, 6, 0.09)",
    hoverBg: "rgba(217, 119, 6, 0.16)",
    badgeBg: "rgba(217, 119, 6, 0.16)",
    badgeText: "#b45309",
    accent: "#f59e0b",
  },
  {
    id: "sky",
    name: "Sky",
    border: "#0284c7",
    bg: "rgba(2, 132, 199, 0.09)",
    hoverBg: "rgba(2, 132, 199, 0.16)",
    badgeBg: "rgba(2, 132, 199, 0.16)",
    badgeText: "#0369a1",
    accent: "#0ea5e9",
  },
  {
    id: "rose",
    name: "Rose",
    border: "#e11d48",
    bg: "rgba(225, 29, 72, 0.09)",
    hoverBg: "rgba(225, 29, 72, 0.16)",
    badgeBg: "rgba(225, 29, 72, 0.16)",
    badgeText: "#be123c",
    accent: "#f43f5e",
  },
  {
    id: "violet",
    name: "Violet",
    border: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.09)",
    hoverBg: "rgba(124, 58, 237, 0.16)",
    badgeBg: "rgba(124, 58, 237, 0.16)",
    badgeText: "#6d28d9",
    accent: "#8b5cf6",
  },
  {
    id: "teal",
    name: "Teal",
    border: "#0d9488",
    bg: "rgba(13, 148, 136, 0.09)",
    hoverBg: "rgba(13, 148, 136, 0.16)",
    badgeBg: "rgba(13, 148, 136, 0.16)",
    badgeText: "#0f766e",
    accent: "#14b8a6",
  },
  {
    id: "orange",
    name: "Orange",
    border: "#ea580c",
    bg: "rgba(234, 88, 12, 0.09)",
    hoverBg: "rgba(234, 88, 12, 0.16)",
    badgeBg: "rgba(234, 88, 12, 0.16)",
    badgeText: "#c2410c",
    accent: "#f97316",
  },
  {
    id: "blue",
    name: "Blue",
    border: "#2563eb",
    bg: "rgba(37, 99, 235, 0.09)",
    hoverBg: "rgba(37, 99, 235, 0.16)",
    badgeBg: "rgba(37, 99, 235, 0.16)",
    badgeText: "#1d4ed8",
    accent: "#3b82f6",
  },
  {
    id: "fuchsia",
    name: "Fuchsia",
    border: "#c026d3",
    bg: "rgba(192, 38, 211, 0.09)",
    hoverBg: "rgba(192, 38, 211, 0.16)",
    badgeBg: "rgba(192, 38, 211, 0.16)",
    badgeText: "#a21caf",
    accent: "#d946ef",
  },
  {
    id: "cyan",
    name: "Cyan",
    border: "#0891b2",
    bg: "rgba(8, 145, 178, 0.09)",
    hoverBg: "rgba(8, 145, 178, 0.16)",
    badgeBg: "rgba(8, 145, 178, 0.16)",
    badgeText: "#0e7490",
    accent: "#06b6d4",
  },
  {
    id: "lime",
    name: "Lime",
    border: "#65a30d",
    bg: "rgba(101, 163, 13, 0.09)",
    hoverBg: "rgba(101, 163, 13, 0.16)",
    badgeBg: "rgba(101, 163, 13, 0.16)",
    badgeText: "#4d7c0f",
    accent: "#84cc16",
  },
];

export const PALETTE = COLOR_PALETTE.map((c) => c.border);

/** Deterministic unique color mapping across a given set of subject codes (no collisions). */
export function buildSubjectColorMap(subjectCodes: string[]): Map<string, TimetableColorTheme> {
  const map = new Map<string, TimetableColorTheme>();
  const unique = Array.from(new Set(subjectCodes)).sort();
  unique.forEach((code, index) => {
    map.set(code, COLOR_PALETTE[index % COLOR_PALETTE.length]);
  });
  return map;
}

export function getColorForSubject(code: string): TimetableColorTheme {
  return COLOR_PALETTE[colorIndexFor(code)];
}

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

/**
 * ISO/date or "HH:MM" → 12-hour display clock.
 *
 * Class/break times are wall-clock values: they are stored in Time columns
 * and read back with getUTCHours (see /api/classes). Formatting must
 * therefore stay in UTC — toLocaleTimeString alone applies the machine's
 * local offset, which is what rendered 09:00 as "02:30 pm".
 */
export function formatTime(value: string) {
  const mins = timeToMinutes(value);
  if (mins === null) return value;
  const d = new Date(Date.UTC(1970, 0, 1, Math.floor(mins / 60), mins % 60));
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
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

/** Week time-window (floored/ceil hour bounds) covering every block + break. */
export function weekRange(
  items: Array<{ startMin: number; endMin: number }>,
  breakWindow?: { start: string; end: string } | null,
) {
  const starts: number[] = items.map((i) => i.startMin);
  const ends: number[] = items.map((i) => i.endMin);
  const bs = breakWindow ? timeToMinutes(breakWindow.start) : null;
  const be = breakWindow ? timeToMinutes(breakWindow.end) : null;
  if (bs !== null) starts.push(bs);
  if (be !== null) ends.push(be);

  const dayStart = starts.length === 0 ? FALLBACK_START : Math.floor(Math.min(...starts) / 60) * 60;
  const dayEnd = ends.length === 0 ? FALLBACK_END : Math.ceil(Math.max(...ends) / 60) * 60;
  return { dayStart, dayEnd, gridMinutes: Math.max(60, dayEnd - dayStart) };
}
