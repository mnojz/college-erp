/**
 * Shared grading scale — used by the client (live grade preview while typing)
 * and the server (authoritative grade stored with each result).
 *
 * Scale: pass mark at 40% (matches the PASS/FAIL threshold on the student
 * results view). Anything below 40% is an F.
 */
export const GRADE_SCALE = [
  { min: 90, grade: "A+", label: "Outstanding" },
  { min: 80, grade: "A", label: "Excellent" },
  { min: 70, grade: "B+", label: "Very Good" },
  { min: 60, grade: "B", label: "Good" },
  { min: 50, grade: "C", label: "Satisfactory" },
  { min: 40, grade: "D", label: "Pass" },
  { min: 0, grade: "F", label: "Fail" },
] as const;

/** Letter grade for a percentage (0–100). Values outside the range clamp. */
export function gradeFor(percentage: number): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    GRADE_SCALE.find((band) => clamped >= band.min)?.grade ??
    GRADE_SCALE[GRADE_SCALE.length - 1].grade
  );
}

/**
 * Letter grade for marks against full marks — the single source of truth for
 * every grade stored in `Result`. Returns null for invalid inputs so callers
 * can skip (rather than store) meaningless values.
 */
export function gradeForMarks(marks: number, maxMarks: number): string | null {
  if (!Number.isFinite(marks) || !Number.isFinite(maxMarks) || maxMarks <= 0) return null;
  return gradeFor((marks / maxMarks) * 100);
}
