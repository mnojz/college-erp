import { prisma } from "@/app/lib/prisma";

/**
 * Shared exam logic: publish-gate computation, teacher→subject ownership,
 * registration-window checks and backlog eligibility.
 * Used by the admin exam APIs, the teacher exam APIs, and the student
 * registration/results APIs so there is a single source of truth.
 */

export type ExamPart = "THEORY" | "PRACTICAL";

/** Who enters marks for an exam-subject part in a session:
 *  - END_SEMESTER + THEORY  → admin (blind copy checking)
 *  - END_SEMESTER + PRACTICAL → the subject's teacher
 *  - MID_TERM (any part)      → the subject's teacher
 */
export function marksEntryRole(
  sessionType: "END_SEMESTER" | "MID_TERM",
  part: ExamPart,
): "ADMIN" | "TEACHER" {
  if (sessionType === "END_SEMESTER" && part === "THEORY") return "ADMIN";
  return "TEACHER";
}

/** Default full marks per exam part when the admin doesn't override. */
export function defaultMaxMarks(part: ExamPart): number {
  return part === "PRACTICAL" ? 50 : 100;
}

/** Whether the registration form is currently editable: the results must not
 * be published and (when a deadline was set) now must be at or before it.
 * Sessions announced before the deadline feature existed (null deadline)
 * stay open until results are published.
 */
export function registrationOpen(
  resultsPublishedAt: Date | string | null,
  registrationDeadline: Date | string | null,
  now: Date = new Date(),
): boolean {
  if (resultsPublishedAt !== null) return false;
  if (registrationDeadline === null) return true;
  return now.getTime() <= new Date(registrationDeadline).getTime();
}

/** Prisma scope: only subjects the given teacher is assigned to (SubjectTeacher). */
export function teacherSubjectScope(userId: string) {
  return { subjectTeachers: { some: { teacher: { userId } } } };
}

export type PublishGateSubject = {
  id: string;
  subjectId: string;
  part: ExamPart;
  maxMarks: number;
  marksPublishedAt: Date | null;
  entryRole: "ADMIN" | "TEACHER";
  subject: { code: string; name: string };
  registeredCount: number;
  markCount: number;
};

/**
 * Per-subject completion for publishing a session's results:
 *  - every REGISTERED student must have a mark (markCount === registeredCount)
 *  - teacher-entered subjects must additionally be teacher-published.
 * Unregistered students are invisible to the gate: a student who never
 * submitted the form needs no marks row.
 */
export function computePublishGate(
  subjects: PublishGateSubject[],
): { canPublish: boolean; blockers: string[]; subjects: Array<PublishGateSubject & { complete: boolean; missing: number }> } {
  const partSuffix = (part: ExamPart) => (part === "PRACTICAL" ? " (PR)" : " (TH)");
  const detailed = subjects.map((s) => {
    const missing = Math.max(0, s.registeredCount - s.markCount);
    const teacherPublished = s.entryRole === "ADMIN" || s.marksPublishedAt !== null;
    const complete = missing === 0 && teacherPublished;
    return { ...s, complete, missing };
  });
  const blockers = detailed
    .filter((s) => !s.complete)
    .map((s) => {
      const label = `${s.subject.code}${partSuffix(s.part)}`;
      if (s.entryRole === "TEACHER" && !s.marksPublishedAt)
        return `${label}: teacher has not published marks`;
      if (s.missing > 0) return `${label}: ${s.missing} registered student(s) missing marks`;
      return `${label}: incomplete`;
    });
  const anyRegistrations = subjects.some((s) => s.registeredCount > 0);
  return { canPublish: blockers.length === 0 && anyRegistrations, blockers, subjects: detailed };
}

/** Roster: active students currently in a (program, semester), ordered by roll. */
export async function examRoster(programId: string, semester: number) {
  return prisma.student.findMany({
    where: { programId, currentSemester: semester, status: "ACTIVE" },
    orderBy: [{ rollNumber: "asc" }, { enrollmentNumber: "asc" }],
    select: {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
}

export type EligiblePart = {
  examSubjectId: string;
  subjectId: string;
  code: string;
  name: string;
  part: ExamPart;
  maxMarks: number;
  alreadyPassed: boolean;
};

/**
 * Which subject parts a student may register for in an announced session.
 *
 *  - Regular (currentSemester === session.semester): every part of every
 *    subject in the session is eligible.
 *  - Backlog (promoted PAST the session's semester): only the parts they
 *    failed (an F-graded mark in a results-published session covering that
 *    subject+part) or never appeared for (a part of this session's subject
 *    with no published mark anywhere for them). Passed parts are excluded so
 *    the other part "stays intact".
 */
export async function examEligibility(
  studentId: string,
  currentSemester: number,
  session: {
    id: string;
    semester: number;
    resultsPublishedAt: Date | null;
    subjects: {
      id: string;
      subjectId: string;
      part: ExamPart;
      maxMarks: unknown;
      subject: { code: string; name: string };
    }[];
  },
): Promise<{ eligible: EligiblePart[]; isBacklog: boolean }> {
  const isBacklog = currentSemester > session.semester;
  if (!isBacklog) {
    return {
      isBacklog: false,
      eligible: session.subjects.map((s) => ({
        examSubjectId: s.id,
        subjectId: s.subjectId,
        code: s.subject.code,
        name: s.subject.name,
        part: s.part,
        maxMarks: Number(s.maxMarks),
        alreadyPassed: false,
      })),
    };
  }

  // Backlog: gather this student's published marks per (subjectId, part).
  const publishedMarks = await prisma.examMark.findMany({
    where: {
      studentId,
      examSubject: { session: { resultsPublishedAt: { not: null } } },
    },
    select: { grade: true, examSubject: { select: { subjectId: true, part: true } } },
  });
  const keyOf = (subjectId: string, part: ExamPart) => `${subjectId}:${part}`;
  // Parts with a published non-F mark anywhere are passed ("stays intact").
  // Everything else — failed (F) or never appeared for — stays eligible.
  const passed = new Set<string>();
  for (const m of publishedMarks) {
    const key = keyOf(m.examSubject.subjectId, m.examSubject.part);
    if (m.grade !== null && m.grade !== "F") passed.add(key);
  }

  const eligible = session.subjects
    .filter((s) => !passed.has(keyOf(s.subjectId, s.part)))
    .map((s) => ({
      examSubjectId: s.id,
      subjectId: s.subjectId,
      code: s.subject.code,
      name: s.subject.name,
      part: s.part,
      maxMarks: Number(s.maxMarks),
      alreadyPassed: false,
    }));
  return { isBacklog: true, eligible };
}

/** Registered student ids per exam-subject id (one query for a whole session). */
export async function registrationsBySubject(sessionId: string): Promise<Map<string, Set<string>>> {
  const rows = await prisma.examRegistration.findMany({
    where: { examSubject: { sessionId } },
    select: { examSubjectId: true, studentId: true },
  });
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    let set = map.get(r.examSubjectId);
    if (!set) {
      set = new Set();
      map.set(r.examSubjectId, set);
    }
    set.add(r.studentId);
  }
  return map;
}