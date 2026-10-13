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


/** Grading scale used by the TH/PR marksheet view. */
export const GRADE_VALUE: Record<string, number> = {
  A: 4.0,
  "A-": 3.6,
  "A--": 3.2,
  "B+": 2.8,
  B: 2.4,
  "B-": 2.0,
  C: 1.6,
  "C-": 1.2,
  D: 0.8,
  F: 0.0,
};

/** Type for a row in the TH/PR marksheet. */
export type MarkRow = {
  /** Combined subject name shown in the row; Th+Pr together */
  subjectName: string;
  /** Credits offered for this subject (split across Th and Pr) */
  totalCredits: number;
  /** Grade for the theory part (TH) */
  thGrade: string | null;
  /** Grade for the practical part (PR) */
  prGrade: string | null;
  /** ExamSubject kind: THEORY or PRACTICAL */
  kind: "THEORY" | "PRACTICAL";
  /** Passed status: false when grade is F */
  passed: boolean;
  /** Combined grade (used for the Final column) */
  finalGrade: string;
  /** Grading scale used by the UI (A+=4.0, A=3.6, A-=3.2, B+=2.8, B=2.4, B-=2.0, C=1.6, C-=1.2, D=0.8, F=0.0) */
  gradeValue: number;
  /** Credit hours earned (only for passed subjects) */
  creditPoints: number;
};

/** Build a marksheet row for the Th/PR table.
 *
 * A subject with both a TH and PR paper contributes its full credit into the
 * theory cell (1 for the practical part) and 1 for the practical cell; the two
 * cells sit side by side in one row. A single-part subject gets everything in
 * its part column with 0 in the other.
 */
export function buildRowForSubject(s: {
  subject: { code: string; name: string; credits: number; kind: "THEORY" | "PRACTICAL" };
  mark: { grade: string | null; gradePoint: number | null | unknown } | null;
  maxMarks: number;
  marks: number | null;
}): MarkRow {
  const passed = s.mark?.grade !== "F";
  const isTheory = s.subject.kind === "THEORY";
  const thGrade = isTheory ? s.mark?.grade ?? null : null;
  const prGrade = isTheory ? null : s.mark?.grade ?? null;

  // Split credits: practical part always gets exactly 1.
  const practicalCredits = 1;
  const theoryCredits = Math.max(0, s.subject.credits - practicalCredits);

  const partGrade = isTheory ? thGrade : prGrade;
  const partValue = partGrade ? (GRADE_VALUE[partGrade] ?? 0) / 100 : 0;

  return {
    subjectName: `${s.subject.code} — ${s.subject.name}`,
    totalCredits: s.subject.credits,
    thGrade,
    prGrade,
    kind: s.subject.kind,
    passed,
    finalGrade: passed ? (partGrade ?? "—") : "F",
    gradeValue: partValue,
    creditPoints: passed ? theoryCredits : 0,
  };
}
