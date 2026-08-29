import { prisma } from "@/app/lib/prisma";

export type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  link?: string | null;
};

/**
 * Fan out an in-app notification to a set of recipient user ids.
 * De-duplicated; the acting user is excluded so people are never
 * notified about their own actions.
 */
export async function notifyUsers(
  userIds: Iterable<string>,
  payload: NotificationPayload,
  options: { excludeUserId?: string } = {},
): Promise<void> {
  const recipients = new Set(userIds);
  if (options.excludeUserId) recipients.delete(options.excludeUserId);
  recipients.delete("");
  if (recipients.size === 0) return;

  await prisma.notification.createMany({
    data: Array.from(recipients).map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
    })),
  });
}

/** Fan out one notification per recipient — for payloads that differ per user. */
export async function notifyEachUser(
  rows: (NotificationPayload & { userId: string })[],
): Promise<void> {
  if (rows.length === 0) return;
  await prisma.notification.createMany({
    data: rows.map(({ userId, ...payload }) => ({ userId, ...payload })),
  });
}

/** Every active student account. */
export async function allStudentUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Every active teacher account. */
export async function allTeacherUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: "TEACHER", status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Every active admin account. */
export async function allAdminUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Students of a program currently in a specific semester. */
export async function studentUserIdsForSemester(
  programId: string,
  semester: number,
): Promise<string[]> {
  const students = await prisma.student.findMany({
    where: { programId, currentSemester: semester },
    select: { userId: true },
  });
  return students.map((s) => s.userId);
}

type MaterialLike = {
  visibility: string;
  programId: string | null;
  semester: number | null;
  classLinks?: { class: { programId: string; semester: number } }[];
};

/**
 * Students who can see a study material, based on its visibility:
 *  - EVERYONE            → all students
 *  - DEPARTMENT_PROGRAM  → students of the linked program (everyone when unlinked)
 *  - CLASSES             → students whose (program, currentSemester) matches a linked class
 */
export async function studentUserIdsForMaterial(material: MaterialLike): Promise<string[]> {
  if (material.visibility === "EVERYONE") return allStudentUserIds();

  if (material.visibility === "DEPARTMENT_PROGRAM") {
    if (material.programId) {
      const students = await prisma.student.findMany({
        where: { programId: material.programId },
        select: { userId: true },
      });
      return students.map((s) => s.userId);
    }
    return allStudentUserIds();
  }

  // CLASSES — teaching groups are (program, semester) pairs.
  const pairs = new Set<string>();
  for (const link of material.classLinks ?? []) {
    pairs.add(`${link.class.programId}:${link.class.semester}`);
  }
  const userIds: string[] = [];
  for (const pair of pairs) {
    const [programId, semester] = pair.split(":");
    if (!programId || !semester) continue;
    const students = await prisma.student.findMany({
      where: { programId, currentSemester: Number.parseInt(semester, 10) },
      select: { userId: true },
    });
    userIds.push(...students.map((s) => s.userId));
  }
  return userIds;
}
