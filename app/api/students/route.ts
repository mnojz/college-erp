import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { parsePageParams, paginatedResponse } from "@/app/lib/pagination";
import { z } from "zod";

/**
 * Query filters for the directory. `status` is the ACCOUNT status (ACTIVE /
 * INACTIVE), not the enrollment lifecycle.
 *
 * `sortBy` keys are shared with `buildStudentOrderBy` so the accepted values and
 * the ordering they produce can't drift apart.
 */
const STUDENT_SORT_KEYS = [
  "recent",
  "name",
  "roll",
  "semester",
  "program",
] as const;
type StudentSortKey = (typeof STUDENT_SORT_KEYS)[number];

const StudentQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  programId: z.string().trim().min(1).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  // Every non-enrolled lifecycle state must be selectable here, or students set
  // to it (e.g. via the edit modal) become unreachable in the directory — the
  // default listing only shows ACTIVE/INACTIVE. GRADUATED/SUSPENDED/DROPPED are
  // all opt-in through this param.
  lifecycle: z.enum(["GRADUATED", "SUSPENDED", "DROPPED"]).optional(),
  // z.coerce.boolean() treats ANY non-empty string as true ("false" → true),
  // so accept only the literal query-string values.
  includeTerminal: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  sortBy: z.enum(STUDENT_SORT_KEYS).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  // Terminal lifecycle states are opt-in: by default the directory shows only
  // students in a live semester (non-null currentSemester + ACTIVE/INACTIVE).
});

/**
 * Map a sort key to a Prisma `orderBy` list.
 *
 * Nullable columns pass `nulls: "last"` in BOTH directions so students without
 * a roll or semester don't jump to the top when the admin flips direction.
 *
 * `id` is appended as a tiebreaker because the directory paginates: without a
 * total order, rows sharing a sort key can land on different pages between
 * requests and visibly shuffle as you page through.
 */
function buildStudentOrderBy(
  key: StudentSortKey,
  dir: Prisma.SortOrder,
): Prisma.StudentOrderByWithRelationInput[] {
  const byName: Prisma.StudentOrderByWithRelationInput[] = [
    { user: { firstName: dir } },
    { user: { lastName: dir } },
  ];

  const primary: Prisma.StudentOrderByWithRelationInput[] = (() => {
    switch (key) {
      case "name":
        return byName;
      case "roll":
        return [{ rollNumber: { sort: dir, nulls: "last" } }];
      case "semester":
        return [{ currentSemester: { sort: dir, nulls: "last" } }];
      // Ordering by relation: students with no program fall where SQL puts a NULL.
      case "program":
        return [{ program: { code: dir } }, { program: { name: dir } }];
      case "recent":
      default:
        return [{ createdAt: dir }];
    }
  })();

  return [...primary, { id: dir }];
}

const STUDENT_SELECT = {
  id: true, enrollmentNumber: true, registrationId: true, rollNumber: true,
  profileImageUrl: true, admissionDate: true, programId: true, currentSemester: true,
  gender: true, nationality: true, religion: true, category: true, status: true,
  program: { select: { id: true, name: true, code: true } },
  user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
} as const;

type CreateStudentBody = {
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  enrollmentNumber?: unknown;
  registrationId?: unknown;
  rollNumber?: unknown;
  profileImageUrl?: unknown;
  admissionDate?: unknown;
  programId?: unknown;
  currentSemester?: unknown;
  // Critical personal information — admin-entered only.
  gender?: unknown;
  nationality?: unknown;
  religion?: unknown;
  category?: unknown;
};

type UpdateStudentBody = {
  id?: unknown;
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  enrollmentNumber?: unknown;
  registrationId?: unknown;
  rollNumber?: unknown;
  profileImageUrl?: unknown;
  admissionDate?: unknown;
  programId?: unknown;
  currentSemester?: unknown;
  // Enrollment lifecycle (drives the status badge on the student's profile).
  status?: unknown;
  // Portal access (User.status) — ACTIVE users can sign in, INACTIVE cannot.
  userStatus?: unknown;
  // Critical personal information — admin-entered only.
  gender?: unknown;
  nationality?: unknown;
  religion?: unknown;
  category?: unknown;
};

/** Valid StudentStatus values, for payload validation. */
const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED", "SUSPENDED", "DROPPED"] as const;

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateStudentBody;
  try {
    body = (await request.json()) as CreateStudentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const enrollmentNumber = typeof body.enrollmentNumber === "string" ? body.enrollmentNumber.trim() : "";
  const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
  // Rolls are integers in the DB, but the form keeps them as text so typing
  // doesn't fight the input — parse here and let the caller reject non-numbers.
  const rollRaw = typeof body.rollNumber === "string" ? body.rollNumber.trim() : "";
  const rollNumber = rollRaw === "" ? null : /^\d+$/.test(rollRaw) ? Number(rollRaw) : NaN;
  const profileImageUrl = typeof body.profileImageUrl === "string" ? body.profileImageUrl.trim() : undefined;
  const admissionDate = typeof body.admissionDate === "string" ? new Date(body.admissionDate) : null;
  const programId = typeof body.programId === "string" ? body.programId : undefined;
  const currentSemester =
    typeof body.currentSemester === "number"
      ? body.currentSemester
      : typeof body.currentSemester === "string" && body.currentSemester !== ""
        ? Number(body.currentSemester)
        : undefined;
  const gender = typeof body.gender === "string" ? body.gender.trim() || null : null;
  const nationality = typeof body.nationality === "string" ? body.nationality.trim() || null : null;
  const religion = typeof body.religion === "string" ? body.religion.trim() || null : null;
  const category = typeof body.category === "string" ? body.category.trim() || null : null;

  if (!email || !password || !firstName || !lastName || !enrollmentNumber || !registrationId || !admissionDate) {
    return NextResponse.json(
      { error: "Email, password, name, enrollment number, registration ID, and admission date are required" },
      { status: 400 },
    );
  }

  if (Number.isNaN(admissionDate.getTime())) {
    return NextResponse.json({ error: "Admission date is invalid" }, { status: 400 });
  }

  if (Number.isNaN(rollNumber)) {
    return NextResponse.json({ error: "Roll number must be a whole number" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Validate semester range against program if both provided
  if (programId && currentSemester !== undefined) {
    const program = await prisma.program.findUnique({ where: { id: programId }, select: { durationYears: true } });
    if (!program) return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
    if (currentSemester < 1 || currentSemester > program.durationYears * 2) {
      return NextResponse.json(
        { error: `Semester must be between 1 and ${program.durationYears * 2} for this program` },
        { status: 400 },
      );
    }
  }

  try {
    const { hash } = await import("bcryptjs");
    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash: await hash(password, 12), firstName, lastName, role: "STUDENT" },
      });
      return tx.student.create({
        data: { userId: user.id, enrollmentNumber, registrationId, rollNumber, profileImageUrl, admissionDate, programId, currentSemester, gender, nationality, religion, category },
        select: {
          id: true, enrollmentNumber: true, registrationId: true, rollNumber: true, profileImageUrl: true,
          admissionDate: true, programId: true, currentSemester: true,
          gender: true, nationality: true, religion: true, category: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      });
    });
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email, enrollment number, registration ID, or roll number in this class is already registered" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
    }
    console.error("POST /api/students error:", error);
    return NextResponse.json({ error: "Unable to create student" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: UpdateStudentBody;
  try {
    body = (await request.json()) as UpdateStudentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const enrollmentNumber = typeof body.enrollmentNumber === "string" ? body.enrollmentNumber.trim() : "";
  const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
  const rollRaw = typeof body.rollNumber === "string" ? body.rollNumber.trim() : "";
  const rollNumber = rollRaw === "" ? null : /^\d+$/.test(rollRaw) ? Number(rollRaw) : NaN;
  const profileImageUrl = typeof body.profileImageUrl === "string" ? (body.profileImageUrl.trim() || null) : null;
  const admissionDate = typeof body.admissionDate === "string" ? new Date(body.admissionDate) : null;
  const programId = typeof body.programId === "string" && body.programId ? body.programId : null;
  const currentSemester =
    typeof body.currentSemester === "number"
      ? body.currentSemester
      : typeof body.currentSemester === "string" && body.currentSemester !== ""
        ? Number(body.currentSemester)
        : null;
  const gender = typeof body.gender === "string" ? body.gender.trim() || null : null;
  const nationality = typeof body.nationality === "string" ? body.nationality.trim() || null : null;
  const religion = typeof body.religion === "string" ? body.religion.trim() || null : null;
  const category = typeof body.category === "string" ? body.category.trim() || null : null;

  // Enrollment lifecycle status (shown as the badge on the student's profile).
  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const status = (STUDENT_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as (typeof STUDENT_STATUSES)[number])
    : undefined;

  // Portal access — ACTIVE users can sign in, INACTIVE are locked out.
  const userStatusRaw = typeof body.userStatus === "string" ? body.userStatus.trim().toUpperCase() : "";
  const userStatus = userStatusRaw === "ACTIVE" || userStatusRaw === "INACTIVE" ? userStatusRaw : undefined;

  if (!id || !email || !firstName || !lastName || !enrollmentNumber || !registrationId || !admissionDate) {
    return NextResponse.json(
      { error: "Student ID, email, name, enrollment number, registration ID, and admission date are required" },
      { status: 400 },
    );
  }

  if (Number.isNaN(admissionDate.getTime())) {
    return NextResponse.json({ error: "Admission date is invalid" }, { status: 400 });
  }

  if (Number.isNaN(rollNumber)) {
    return NextResponse.json({ error: "Roll number must be a whole number" }, { status: 400 });
  }

  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters if provided" }, { status: 400 });
  }

  // Validate semester range against program if both provided
  if (programId && currentSemester !== null) {
    const program = await prisma.program.findUnique({ where: { id: programId }, select: { durationYears: true } });
    if (!program) return NextResponse.json({ error: "Program does not exist" }, { status: 400 });
    if (currentSemester < 1 || currentSemester > program.durationYears * 2) {
      return NextResponse.json(
        { error: `Semester must be between 1 and ${program.durationYears * 2} for this program` },
        { status: 400 },
      );
    }
  }

  const existingStudent = await prisma.student.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!existingStudent) {
    return NextResponse.json({ error: "Student record not found" }, { status: 404 });
  }

  try {
    const { hash } = await import("bcryptjs");
    const updatedStudent = await prisma.$transaction(async (tx) => {
      const userData: Prisma.UserUpdateInput = {
        email,
        firstName,
        lastName,
        ...(userStatus ? { status: userStatus } : {}),
      };

      if (password) {
        userData.passwordHash = await hash(password, 12);
      }

      await tx.user.update({
        where: { id: existingStudent.userId },
        data: userData,
      });

      return tx.student.update({
        where: { id },
        data: {
          enrollmentNumber,
          registrationId,
          rollNumber,
          profileImageUrl,
          admissionDate,
          programId,
          currentSemester,
          gender,
          nationality,
          religion,
          category,
          ...(status ? { status } : {}),
        },
        select: {
          id: true,
          status: true,
          enrollmentNumber: true,
          registrationId: true,
          rollNumber: true,
          profileImageUrl: true,
          admissionDate: true,
          programId: true,
          currentSemester: true,
          gender: true,
          nationality: true,
          religion: true,
          category: true,
          program: { select: { id: true, name: true, code: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
        },
      });
    });

    return NextResponse.json({ student: updatedStudent }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Email, enrollment number, registration ID, or roll number in this class is already in use" },
        { status: 409 },
      );
    }
    console.error("PUT /api/students error:", error);
    return NextResponse.json({ error: "Unable to update student account" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");

  if (!id) {
    try {
      const body = (await request.json()) as { id?: string };
      id = body?.id ?? null;
    } catch {
      // url param was already null
    }
  }

  if (!id) {
    return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.result.deleteMany({ where: { studentId: id } });
      await tx.attendanceRecord.deleteMany({ where: { studentId: id } });
      await tx.student.delete({ where: { id } });
      await tx.user.delete({ where: { id: student.userId } });
    });

    return NextResponse.json({ success: true, message: "Student account deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/students error:", error);
    return NextResponse.json({ error: "Unable to delete student account" }, { status: 500 });
  }
}

/**
 * GET /api/students — paginated + filtered student directory.
 *
 * Filtering happens in the database rather than in the client: at ~1000
 * students, shipping every row and filtering in the browser means a large
 * payload on every load AND filters that can only ever match the rows that
 * happen to be on the current page.
 *
 *   ?page=1&pageSize=25&q=ram&programId=<id>&semester=3&status=ACTIVE
 */
export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip, limit } = parsePageParams(searchParams, { pageSize: 25 });

  // Treat empty query values (?programId=&semester=) as "no filter".
  const rawQuery = Object.fromEntries([...searchParams.entries()].filter(([, v]) => v !== ""));
  const parsed = StudentQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
  const f = parsed.data;

  // rollNumber is an INTEGER now, so substring matching is impossible: match an
  // exact value when the query is numeric and skip that arm otherwise. Names,
  // enrollment numbers and registration IDs still match by substring.
  const searchArms: Prisma.StudentWhereInput[] = [
    { user: { firstName: { contains: f.q, mode: "insensitive" } } },
    { user: { lastName: { contains: f.q, mode: "insensitive" } } },
    { user: { email: { contains: f.q, mode: "insensitive" } } },
    { enrollmentNumber: { contains: f.q, mode: "insensitive" } },
    { registrationId: { contains: f.q, mode: "insensitive" } },
    ...(f.q && /^\d+$/.test(f.q) ? [{ rollNumber: { equals: Number(f.q) } }] : []),
  ];

  // NOTE: these spreads must never set the same key twice — a later spread
  // silently OVERWRITES an earlier one (that bug made `?semester=4` a no-op:
  // the default clause below re-set `currentSemester: { not: null }`). Each
  // key is therefore set in exactly one place below.
  const liveListing = !f.lifecycle && !f.includeTerminal;
  const where: Prisma.StudentWhereInput = {
    ...(f.programId ? { programId: f.programId } : {}),
    // The semester filter IS a currentSemester value — it replaces (never
    // coexists with) the default "in a live semester" constraint.
    ...(f.semester
      ? { currentSemester: f.semester }
      : liveListing
        ? { currentSemester: { not: null } }
        : {}),
    ...(f.status ? { user: { status: f.status } } : {}),
    ...(f.q ? { OR: searchArms } : {}),
    // Graduated/dropped students sit outside semesters: a lifecycle filter
    // selects exactly that state; otherwise they are hidden unless the admin
    // explicitly includes terminal states.
    ...(f.lifecycle ? { status: f.lifecycle } : {}),
    ...(liveListing ? { status: { in: ["ACTIVE", "INACTIVE"] as const } } : {}),
  };

  try {
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        // "recent"/desc is what the directory did before sorting existed, so
        // callers that send no sort params keep seeing the same order.
        orderBy: buildStudentOrderBy(f.sortBy ?? "recent", f.sortDir ?? "desc"),
        skip,
        take: limit,
        select: STUDENT_SELECT,
      }),
      prisma.student.count({ where }),
    ]);
    const { items, pagination } = paginatedResponse(students, total, page, pageSize);
    return NextResponse.json({ students: items, pagination });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json(
      { error: "Unable to load students" },
      { status: 500 },
    );
  }
}
