/**
 * Shared constants/types/helpers for the Syllabi module.
 * Pure TypeScript (no server-only imports) so both API routes and
 * client components can consume it.
 */

export const MAX_SYLLABUS_BYTES = 50 * 1024 * 1024; // 50 MB per PDF

/** Syllabi are always PDFs. */
export const ALLOWED_SYLLABUS_MIME = ["application/pdf"];

export const BLOCKED_EXTENSIONS = [
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".dll", ".vbs", ".ps1",
];

/** Semester 1..8 as the project treats syllabi as program-wide, year-agnostic. */
export const SEMESTERS: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

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

/** Derive a readable display title from a file name (strips extension). */
export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, "").replace(/_/g, " ").trim() || "Syllabus";
}

/** Client-safe shape returned by every syllabus endpoint (never includes file bytes). */
export type SyllabusDto = {
  id: string;
  title: string | null;
  departmentName: string;
  programId: string | null;
  programCode: string | null;
  programName: string | null;
  semester: number;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
};

export type SyllabusMeta = {
  departments: string[];
  programs: { id: string; name: string; code: string; departmentName: string }[];
};

/** Alias used by filter toolbars / pages. Same shape as SyllabusMeta. */
export type ProgramsMeta = SyllabusMeta;

/** Resolve a display title (fall back to a filename-derived one). */
export function resolveTitle(s: { title: string | null; fileName: string }): string {
  return s.title || titleFromFileName(s.fileName);
}
