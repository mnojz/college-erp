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

// ---------------------------------------------------------------------------
// TH/PR marksheet grading scale
// Matches TU Nepal's standard letter-grade → GPA conversion used on marksheets.
// ---------------------------------------------------------------------------

export const GRADE_VALUE: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.56,
  "B+": 3.2,
  B: 2.8,
  "B-": 2.96,
  C: 2.56,
  "C-": 2.0,
  D: 1.6,
  F: 0.0,
};

/**
 * One row in the TH/PR results table.
 *
 * Each subject part (THEORY or PRACTICAL) is its own row. A subject that has
 * both parts produces two rows — one TH row and one PR row.
 */
export type MarkRow = {
  /** Subject course code, e.g. "EX352" */
  subjectCode: string;
  /**
   * Display name: includes " TH" or " PR" suffix when the subject has a
   * counterpart, e.g. "Instrumentation TH" / "Instrumentation PR".
   */
  subjectName: string;
  /** Credit hours for this specific part (practical part is always 1 credit). */
  credits: number;
  /** Grade earned in the Theory column (null for PR rows). */
  thGrade: string | null;
  /** Grade earned in the Practical column (null for TH rows). */
  prGrade: string | null;
  /** Which part this row represents. */
  kind: "THEORY" | "PRACTICAL";
  /** True when the student passed this part (grade ≠ F and grade exists). */
  passed: boolean;
  /**
   * Final grade for this row: same as obtained grade when passed; "F" when
   * failed; "—" when no grade exists yet.
   */
  finalGrade: string;
  /**
   * Numeric grade value from the GRADE_VALUE scale.
   * 0.0 for F or when no grade exists.
   */
  gradeValue: number;
  /**
   * Grade point = credits × gradeValue.
   * 0.0 when failed (no credit earned).
   */
  gradePoint: number;
};

/**
 * Build a single MarkRow for one subject part (THEORY or PRACTICAL).
 *
 * Credit hour rules:
 *   - If the subject has a practical counterpart (hasPractical = true for a
 *     theory row): credits = totalSubjectCredits - 1
 *   - The practical row always gets credits = 1
 *   - A theory-only subject keeps its full credit hours as-is
 */
export function buildRowForSubject(s: {
  subject: {
    code: string;
    name: string;
    credits: number;
    kind: "THEORY" | "PRACTICAL";
    /** True when the subject has both a TH and PR component. */
    hasPractical: boolean;
  };
  mark: { grade: string | null } | null;
}): MarkRow {
  const { subject, mark } = s;
  const isTheory = subject.kind === "THEORY";

  // Credit split: PR part always 1; TH part gets the remainder.
  const credits = isTheory
    ? subject.hasPractical
      ? Math.max(1, subject.credits - 1)
      : subject.credits
    : 1;

  const obtainedGrade = mark?.grade ?? null;

  // Only show grade in the correct sub-column.
  const thGrade = isTheory ? obtainedGrade : null;
  const prGrade = isTheory ? null : obtainedGrade;

  // Passed = grade exists and is not F.
  const passed = !!obtainedGrade && obtainedGrade !== "F";

  // Final grade: show grade when passed, "F" when failed, "—" when no data.
  const finalGrade = obtainedGrade ? (passed ? obtainedGrade : "F") : "—";

  const gradeValue = obtainedGrade ? (GRADE_VALUE[obtainedGrade] ?? 0.0) : 0.0;

  // Grade point earned: 0 when failed (student earns no credit).
  const gradePoint = passed ? credits * gradeValue : 0.0;

  // Subject name suffix: append " TH" or " PR" only when the subject has both parts.
  const nameSuffix = subject.hasPractical ? (isTheory ? " TH" : " PR") : "";

  return {
    subjectCode: subject.code,
    subjectName: `${subject.name}${nameSuffix}`,
    credits,
    thGrade,
    prGrade,
    kind: subject.kind,
    passed,
    finalGrade,
    gradeValue,
    gradePoint,
  };
}
