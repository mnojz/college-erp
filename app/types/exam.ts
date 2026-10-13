/** Shared client-side shapes for the student exam-registration flow.
 *  Mirrors the payload returned by GET /api/student/exams.
 */

export type ExamType = "END_SEMESTER" | "MID_TERM";
export type ExamPart = "THEORY" | "PRACTICAL";
export type ExamSessionStatus = "DRAFT" | "ANNOUNCED" | "RESULTS_PUBLISHED";

export type ExamProgram = { name: string; code: string };

export type ExamSession = {
  id: string;
  title: string;
  type: ExamType;
  semester: number;
  program?: ExamProgram | null;
  status: ExamSessionStatus;
  registrationDeadline: string | null;
  routinePublishedAt: string | null;
  resultsPublishedAt: string | null;
  isBacklog?: boolean;
};

/** One subject part a student may register for. `id` is the ExamSubject id. */
export type ExamSubject = {
  id: string;
  part: ExamPart;
  code: string;
  name: string;
  maxMarks: number;
};

/** One TH/PR cell of the registration table: the ExamSubject row for that
 *  part (when the session offers it) plus this student's per-part state. */
export type ExamSubjectCell = {
  /** ExamSubject id — this is what a checked box submits for the part. */
  id: string;
  maxMarks: number;
  eligible: boolean;
  registered: boolean;
  /** Backlog only: the student already passed this part, so it stays locked. */
  passed: boolean;
};

/** One subject row of the registration table (theory + practical columns). */
export type ExamSubjectRow = {
  subjectId: string;
  code: string;
  name: string;
  /** null when the session offers no theory paper / no practical for it. */
  th: ExamSubjectCell | null;
  pr: ExamSubjectCell | null;
};

/** One day of the published routine (read-only for students). */
export type ExamRoutineRow = {
  date: string;
  subject: { code: string; name: string } | null;
};

/** Payload of GET /api/student/exams/[id] — the exam detail page. */
export type ExamDetail = {
  exam: ExamSession;
  window: { open: boolean };
  routine: ExamRoutineRow[];
  rows: ExamSubjectRow[];
  hasRegistrations: boolean;
};
