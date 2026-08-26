import type { Prisma, PrismaClient } from "../generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type SyncResult = {
  created: number;
  updated: number;
  removed: number;
};

/**
 * Derives `Subject` rows from the published curriculum of a program.
 *
 * - Every curriculum course that has a code becomes (or updates) a Subject,
 *   using the curriculum's position to compute the global semester number.
 * - Subjects of this program whose code no longer exists in the curriculum
 *   are removed — but only when they are not referenced by any class or
 *   assessment, so operational history is never destroyed.
 *
 * The db client is injected so this works inside API routes, transactions,
 * or the seed script.
 */
export async function syncSubjectsFromCurriculum(
  db: Db,
  programId: string,
): Promise<SyncResult> {
  const curriculum = await db.curriculum.findUnique({
    where: { programId },
    include: {
      years: {
        orderBy: { yearNo: "asc" },
        include: {
          semesters: {
            orderBy: { semesterNo: "asc" },
            include: { courses: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  if (!curriculum) return { created: 0, updated: 0, removed: 0 };

  // Flatten years → semesters assigning global semester numbers (1-based)
  // in curriculum order.
  const desired = new Map<string, { name: string; semester: number }>();
  let globalSemesterNo = 0;

  for (const year of curriculum.years) {
    for (const semester of year.semesters) {
      globalSemesterNo += 1;
      for (const course of semester.courses) {
        if (!course.code) continue; // courses without a code can't become Subjects
        desired.set(course.code.trim().toUpperCase(), {
          name: course.name,
          semester: globalSemesterNo,
        });
      }
    }
  }

  let created = 0;
  let updated = 0;

  for (const [code, info] of desired) {
    const existing = await db.subject.findUnique({ where: { code } });

    if (!existing) {
      await db.subject.create({
        data: { code, name: info.name, programId, semester: info.semester },
      });
      created += 1;
      continue;
    }

    if (
      existing.name !== info.name ||
      existing.programId !== programId ||
      existing.semester !== info.semester
    ) {
      await db.subject.update({
        where: { code },
        data: { name: info.name, programId, semester: info.semester },
      });
      updated += 1;
    }
  }

  // Remove subjects of this program that left the curriculum and are unused.
  const currentSubjects = await db.subject.findMany({
    where: { programId },
    select: {
      id: true,
      code: true,
      _count: { select: { classes: true, assessments: true } },
    },
  });

  let removed = 0;
  for (const subject of currentSubjects) {
    const stillInCurriculum =
      subject.code !== null && desired.has(subject.code.toUpperCase());
    const inUse = subject._count.classes > 0 || subject._count.assessments > 0;
    if (!stillInCurriculum && !inUse) {
      await db.subject.delete({ where: { id: subject.id } });
      removed += 1;
    }
  }

  return { created, updated, removed };
}
