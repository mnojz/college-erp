/**
 * Shared constants/types/helpers for the Notes / Study Materials module.
 * Pure TypeScript (no server-only imports) so both API routes and
 * client components can consume it.
 */

export const MATERIAL_TYPES = [
  { value: "LECTURE_NOTES", label: "Lecture Notes" },
  { value: "SLIDES", label: "Slides" },
  { value: "QUESTION_BANK", label: "Question Bank" },
  { value: "LAB_MANUAL", label: "Lab Manual" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "REFERENCE_MATERIAL", label: "Reference Material" },
  { value: "PAST_PAPER", label: "Past Paper" },
  { value: "OTHER", label: "Other" },
] as const;

export type MaterialTypeValue = (typeof MATERIAL_TYPES)[number]["value"];

export const MATERIAL_TYPE_VALUES: readonly string[] = MATERIAL_TYPES.map((t) => t.value);

export function materialTypeLabel(value: string): string {
  return MATERIAL_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Short monogram + accent color per type (matches the dashboard sky-blue family). */
export const MATERIAL_TYPE_STYLE: Record<string, { monogram: string; bg: string; color: string }> = {
  LECTURE_NOTES: { monogram: "LN", bg: "#e0f2fe", color: "#0369a1" },
  SLIDES: { monogram: "SL", bg: "#ede9fe", color: "#6d28d9" },
  QUESTION_BANK: { monogram: "QB", bg: "#fef3c7", color: "#b45309" },
  LAB_MANUAL: { monogram: "LB", bg: "#dcfce7", color: "#15803d" },
  ASSIGNMENT: { monogram: "AS", bg: "#ffe4e6", color: "#be123c" },
  REFERENCE_MATERIAL: { monogram: "RF", bg: "#ccfbf1", color: "#0f766e" },
  PAST_PAPER: { monogram: "PP", bg: "#f1f5f9", color: "#475569" },
  OTHER: { monogram: "OT", bg: "#e2e8f0", color: "#334155" },
};

export const VISIBILITY_OPTIONS = [
  {
    value: "EVERYONE",
    label: "Everyone",
    hint: "Published to the whole college library — still surfaced automatically to relevant students.",
  },
  {
    value: "DEPARTMENT_PROGRAM",
    label: "Department / Program",
    hint: "Visible to viewers of the selected department or program.",
  },
  {
    value: "CLASSES",
    label: "Specific Classes",
    hint: "Restricted to the teaching groups you pick below.",
  },
] as const;

export type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];

export const VISIBILITY_LABELS: Record<string, string> = {
  EVERYONE: "Everyone",
  DEPARTMENT_PROGRAM: "Department / Program",
  CLASSES: "Specific Classes",
};

export const VISIBILITY_VALUES: readonly string[] = VISIBILITY_OPTIONS.map((v) => v.value);

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const BLOCKED_EXTENSIONS = [
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".dll", ".vbs", ".ps1",
];

export function blockedExtension(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  return BLOCKED_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Client-safe shape returned by every material endpoint (never includes file bytes). */
export type StudyMaterialDto = {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  materialType: string;
  visibility: string;
  departmentName: string | null;
  programId: string | null;
  subjectId: string | null;
  semester: number | null;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  bookmarked: boolean;
  bookmarkCount: number;
  subject: { id: string; name: string; code: string } | null;
  program: { id: string; name: string; code: string; departmentName: string } | null;
  uploader: { id: string; name: string };
};

export type ProgramsMeta = {
  departments: string[];
  programs: { id: string; name: string; code: string; departmentName: string; durationYears: number }[];
  subjects: { id: string; name: string; code: string; programId: string; semester: number }[];
  teachers: { id: string; name: string }[];
};

export function semestersForDuration(durationYears: number): number[] {
  const total = Math.max(2, Math.min(12, Math.round(durationYears) * 2));
  return Array.from({ length: total }, (_, i) => i + 1);
}

/* ─── Client-side recency tracking (Recent tab) ─────────────── */
const RECENT_KEY = "college_erp_recent_materials";
const RECENT_LIMIT = 50;

export function rememberRecentMaterial(materialId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const entries: { id: string; ts: number }[] = raw ? JSON.parse(raw) : [];
    const next = [{ id: materialId, ts: Date.now() }, ...entries.filter((e) => e.id !== materialId)].slice(
      0,
      RECENT_LIMIT,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function readRecentMaterialIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const entries: { id: string; ts: number }[] = raw ? JSON.parse(raw) : [];
    return entries.sort((a, b) => b.ts - a.ts).map((e) => e.id);
  } catch {
    return [];
  }
}
