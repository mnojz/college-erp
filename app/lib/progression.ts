import type { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Semester progression: the batch-aware helpers behind cohort advancement and
 * bulk intake.
 *
 * Mental model — the "soft rule":
 *
 * - Students are admitted yearly, so normally only one semester per program
 *   has students at a time. Promoting 1st → 2nd makes semester 1 vanish from
 *   every batch-dependent picker until the next intake.
 * - Promotion is manual and per-cohort, so transition windows exist (4th → 5th
 *   done while 6th lingers a few days). Both list while both have students.
 * - Curriculum data (subjects, materials, syllabus) is keyed to the
 *   THEORETICAL range (durationYears × 2) and never consults this module.
 *
 * A "cohort" is the set of students sharing (programId, currentSemester).
 * StudentSemester rows are the source of truth; Student.currentSemester is a
 * cache kept in sync by every writer here.
 */

export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export const TERMINAL_STATUSES = ["GRADUATED", "DROPPED"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function maxSemesterFor(durationYears: number | null | undefined): number {
  return (durationYears ?? 4) * 2;
}

/**
 * Distinct semester numbers that currently have ACTIVE students, optionally
 * scoped to one program. Drives every batch-dependent picker ("the semester
 * in the list exists if the students exist").
 */
export async function getActiveSemesters(
  db: Tx,
  programId?: string,
): Promise<number[]> {
  const rows = await db.student.findMany({
    where: {
      status: "ACTIVE",
      currentSemester: { not: null },
      ...(programId ? { programId } : {}),
    },
    select: { currentSemester: true },
    distinct: ["currentSemester"],
  });
  return rows
    .map((r) => r.currentSemester as number)
    .sort((a, b) => a - b);
}


/**
 * Cohort summary per program: each active (program, semester) pair with its
 * headcount, plus whether it is the program's final semester (advancing it
 * graduates the cohort instead).
 */
export type CohortSummary = {
  programId: string;
  programCode: string;
  programName: string;
  semester: number;
  studentCount: number;
  isFinalSemester: boolean;
};

export async function getCohortSummaries(db: Tx): Promise<CohortSummary[]> {
  const [students, programs] = await Promise.all([
    db.student.findMany({
      where: { status: "ACTIVE", currentSemester: { not: null } },
      select: { programId: true, currentSemester: true },
    }),
    db.program.findMany({
      where: { archivedAt: null },
      select: { id: true, code: true, name: true, durationYears: true },
    }),
  ]);

  const programById = new Map(programs.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  for (const s of students) {
    if (!s.programId || s.currentSemester == null) continue;
    const key = `${s.programId}::${s.currentSemester}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: CohortSummary[] = [];
  for (const [key, studentCount] of counts) {
    const [programId, sem] = key.split("::");
    const program = programById.get(programId);
    if (!program) continue;
    const semester = Number(sem);
    out.push({
      programId,
      programCode: program.code,
      programName: program.name,
      semester,
      studentCount,
      isFinalSemester: semester >= maxSemesterFor(program.durationYears),
    });
  }
  out.sort(
    (a, b) =>
      a.programCode.localeCompare(b.programCode) || a.semester - b.semester,
  );
  return out;
}

export type CohortPreview = {
  programId: string;
  programCode: string;
  programName: string;
  fromSemester: number;
  /** Null when this advance graduates the cohort (final semester). */
  toSemester: number | null;
  graduates: boolean;
  students: Array<{
    id: string;
    enrollmentNumber: string;
    firstName: string;
    lastName: string;
  }>;
};

/**
 * Resolve the current academic year. Semester history rows must attach to a
 * year — the alternative (null academicYearId) would break the unique
 * constraint and the history view.
 */
export async function requireCurrentAcademicYear(
  db: Tx,
): Promise<{ id: string; name: string }> {
  const current = await db.academicYear.findFirst({
    where: { isCurrent: true, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  if (!current) {
    throw new Error("NO_CURRENT_YEAR:No current academic year is set");
  }
  return current;
}

/**
 * Preview a cohort advance: who moves, where to, or whether they graduate.
 */
export async function previewCohortAdvance(
  db: Tx,
  programId: string,
  fromSemester: number,
): Promise<CohortPreview> {
  const program = await db.program.findUnique({
    where: { id: programId },
    select: { id: true, code: true, name: true, durationYears: true },
  });
  if (!program) throw new Error("NOT_FOUND:Program not found");

  const students = await db.student.findMany({
    where: { programId, currentSemester: fromSemester, status: "ACTIVE" },
    orderBy: [{ rollNumber: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    select: {
      id: true,
      enrollmentNumber: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (students.length === 0) {
    throw new Error("EMPTY:No active students in this cohort");
  }

  const graduates = fromSemester >= maxSemesterFor(program.durationYears);
  return {
    programId: program.id,
    programCode: program.code,
    programName: program.name,
    fromSemester,
    toSemester: graduates ? null : fromSemester + 1,
    graduates,
    students: students.map((s) => ({
      id: s.id,
      enrollmentNumber: s.enrollmentNumber,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
    })),
  };
}


/**
 * Advance one student within a transaction: close lower ACTIVE rows for the
 * year as COMPLETED, upsert the new ACTIVE row, sync the currentSemester
 * cache. Same semantics as POST /api/student-semesters, reused per student by
 * the cohort advance.
 */
export async function advanceStudentTx(
  tx: Tx,
  studentId: string,
  toSemester: number,
  academicYearId: string,
  now: Date,
): Promise<void> {
  await tx.studentSemester.updateMany({
    where: {
      studentId,
      academicYearId,
      status: "ACTIVE",
      semesterNo: { lt: toSemester },
    },
    data: { status: "COMPLETED", endDate: now },
  });

  await tx.studentSemester.upsert({
    where: {
      studentId_academicYearId_semesterNo: {
        studentId,
        academicYearId,
        semesterNo: toSemester,
      },
    },
    update: { status: "ACTIVE", startDate: now, endDate: null },
    create: {
      studentId,
      academicYearId,
      semesterNo: toSemester,
      status: "ACTIVE",
      startDate: now,
    },
  });

  await tx.student.update({
    where: { id: studentId },
    data: { currentSemester: toSemester },
  });
}

/**
 * Graduate one student within a transaction: close ALL their ACTIVE rows as
 * COMPLETED, mark GRADUATED with no semester. Graduates keep full history but
 * vanish from every batch-dependent picker and roster (all keyed on ACTIVE +
 * non-null currentSemester).
 */
export async function graduateStudentTx(
  tx: Tx,
  studentId: string,
  now: Date,
): Promise<void> {
  await tx.studentSemester.updateMany({
    where: { studentId, status: "ACTIVE" },
    data: { status: "COMPLETED", endDate: now },
  });

  await tx.student.update({
    where: { id: studentId },
    data: { currentSemester: null, status: "GRADUATED" },
  });
}


/** Split "UMESH RAJ UPADHYAY" into first/last on the last token. */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Name needs a first and last part: ${full}`);
  }
  const cap = (s: string) =>
    s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
  return {
    firstName: cap(parts.slice(0, -1).join(" ")),
    lastName: cap(parts[parts.length - 1]),
  };
}

export type BulkStudentInput = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  firstName: string;
  lastName: string;
  email: string;
};


/**
 * Validate a bulk-intake payload BEFORE any write. Returns normalized rows or
 * a list of human-readable problems (1-based row numbers) for the preview UI.
 * Checks: required fields, intra-file duplicates, collisions with existing
 * enrollment/registration/email/roll, and program/semester bounds.
 */
export async function validateBulkIntake(
  db: Tx,
  programId: string,
  semester: number,
  rows: BulkStudentInput[],
): Promise<{ ok: true; rows: BulkStudentInput[] } | { ok: false; problems: string[] }> {
  const problems: string[] = [];

  const program = await db.program.findUnique({
    where: { id: programId },
    select: { id: true, code: true, durationYears: true, archivedAt: true },
  });
  if (!program) return { ok: false, problems: ["Program not found"] };
  if (program.archivedAt) {
    return { ok: false, problems: ["Program is archived — admit into an active program"] };
  }
  const maxSem = maxSemesterFor(program.durationYears);
  if (!Number.isInteger(semester) || semester < 1 || semester > maxSem) {
    return { ok: false, problems: [`Semester must be between 1 and ${maxSem} for ${program.code}`] };
  }
  if (rows.length === 0) return { ok: false, problems: ["No student rows found in the file"] };
  if (rows.length > 500) return { ok: false, problems: ["Bulk intake is limited to 500 students per file"] };

  const seen = (label: string) => {
    const set = new Set<string>();
    return (value: string, i: number) => {
      const key = value.toLowerCase();
      if (set.has(key)) problems.push(`Row ${i + 1}: duplicate ${label} "${value}" within the file`);
      set.add(key);
    };
  };
  const seenEnroll = seen("enrollment number");
  const seenReg = seen("registration ID");
  const seenEmail = seen("email");
  const seenRoll = new Set<number>();

  rows.forEach((r, i) => {
    const n = i + 1;
    if (!r.enrollmentNumber.trim()) problems.push(`Row ${n}: enrollment number is required`);
    if (!r.registrationId.trim()) problems.push(`Row ${n}: registration ID is required`);
    if (!r.firstName.trim() || !r.lastName.trim()) problems.push(`Row ${n}: first and last name are required`);
    if (!r.email.trim()) problems.push(`Row ${n}: email is required`);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) problems.push(`Row ${n}: email invalid`);
    if (r.rollNumber !== null && (!Number.isInteger(r.rollNumber) || r.rollNumber < 1)) {
      problems.push(`Row ${n}: roll number must be a positive integer`);
    }
    seenEnroll(r.enrollmentNumber, i);
    seenReg(r.registrationId, i);
    seenEmail(r.email, i);
    if (r.rollNumber !== null) {
      if (seenRoll.has(r.rollNumber)) problems.push(`Row ${n}: duplicate roll number within the file`);
      seenRoll.add(r.rollNumber);
    }
  });

  if (problems.length > 0) return { ok: false, problems };

  const rollValues = rows.filter((r) => r.rollNumber !== null).map((r) => r.rollNumber as number);
  const [enrollClash, regClash, emailClash, rollClash] = await Promise.all([
    db.student.findMany({
      where: { enrollmentNumber: { in: rows.map((r) => r.enrollmentNumber) } },
      select: { enrollmentNumber: true },
    }),
    db.student.findMany({
      where: { registrationId: { in: rows.map((r) => r.registrationId) } },
      select: { registrationId: true },
    }),
    db.user.findMany({
      where: { email: { in: rows.map((r) => r.email.toLowerCase()) } },
      select: { email: true },
    }),
    rollValues.length > 0
      ? db.student.findMany({
          where: { rollNumber: { in: rollValues } },
          select: { rollNumber: true },
        })
      : Promise.resolve([] as Array<{ rollNumber: number | null }>),
  ]);
  for (const c of enrollClash) problems.push(`Enrollment "${c.enrollmentNumber}" already exists`);
  for (const c of regClash) problems.push(`Registration "${c.registrationId}" already exists`);
  for (const c of emailClash) problems.push(`Email "${c.email}" already exists`);
  for (const c of rollClash) problems.push(`Roll number ${c.rollNumber} already exists`);

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, rows };
}

/** JSON value guard for the bulk payload. */
export function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Accept the entrance-system shape (student_name / registration_no /
 * roll_number) as well as plain camelCase keys.
 */
export function parseBulkRow(v: unknown): BulkStudentInput | null {
  const r = asRecord(v);
  if (!r) return null;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const rollRaw = r.rollNumber ?? r.roll_number ?? r.roll;
  const rollParsed =
    rollRaw === null || rollRaw === undefined || rollRaw === ""
      ? null
      : typeof rollRaw === "number"
        ? rollRaw
        : Number(String(rollRaw).trim());
  const fullName = str("student_name") || `${str("firstName")} ${str("lastName")}`.trim();
  let firstName = str("firstName");
  let lastName = str("lastName");
  if ((!firstName || !lastName) && fullName) {
    try {
      const split = splitFullName(fullName);
      firstName = firstName || split.firstName;
      lastName = lastName || split.lastName;
    } catch {
      firstName = firstName || fullName;
    }
  }
  return {
    enrollmentNumber: str("enrollmentNumber") || str("enrollment_no") || str("enrollment"),
    registrationId: str("registrationId") || str("registration_no") || str("registration"),
    rollNumber: Number.isInteger(rollParsed) ? (rollParsed as number) : null,
    firstName,
    lastName,
    email: str("email").toLowerCase(),
  };
}
