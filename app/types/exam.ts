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
