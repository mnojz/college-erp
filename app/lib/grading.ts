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

/** Letter grade for marks against full marks — the single source of truth for
 * every grade stored in exam results. Returns null for invalid inputs so callers
 * can skip (rather than store) meaningless values.
 */
export function gradeForMarks(marks: number, maxMarks: number): string | null {
  if (!Number.isFinite(marks) || !Number.isFinite(maxMarks) || maxMarks <= 0) return null;
  return gradeFor((marks / maxMarks) * 100);
}

/**
 * Grade-point scale (TU/Nepal): the numeric GPA value behind each letter grade.
 * F is a hard 0.0 so a failed subject always drags the GPA down. Used by the
 * server when storing ExamMark.gradePoint and by the client for live previews.
 */
export const GRADE_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 3.6,
  "B+": 3.2,
  B: 2.8,
  C: 2.4,
  D: 2.0,
  F: 0.0,
};

/** Grade point (0.0–4.0) for a letter grade; null/unknown grades yield null. */
export function gradePointForLetter(grade: string | null | undefined): number | null {
  if (!grade) return null;
  return GRADE_POINTS[grade] ?? null;
}

/** Grade point for marks against full marks — the single source of truth for
 * every gradePoint stored on ExamMark. Returns null for invalid inputs. */
export function gradePointForMarks(marks: number, maxMarks: number): number | null {
  const letter = gradeForMarks(marks, maxMarks);
  return letter ? gradePointForLetter(letter) : null;
}

/**
 * Session GPA: the unweighted mean of a student's per-subject grade points.
 * F subjects count as 0.0. Returns null when there are no subjects to average
 * (e.g. nothing entered yet) so callers can render "—" rather than a fake 0.0.
 */
export function sessionGpa(gradePoints: (number | null)[]): number | null {
  const values = gradePoints.filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}
