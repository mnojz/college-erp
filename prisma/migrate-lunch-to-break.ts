// One-off migration: convert legacy lunch-break Class rows (backed by the
// hidden "LUNCH" pseudo-subject) into dedicated Break rows, then remove the
// pseudo-subject and its teacher assignments entirely.
//
// Run AFTER `npm run db:push` has created the Break table:
//   npx tsx prisma/migrate-lunch-to-break.ts
//
// Idempotent — safe to run more than once.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const LUNCH_SUBJECT_CODE = "LUNCH";

async function main() {
  // 1) Legacy lunch class rows → Break rows (one per program+semester).
  const lunchClasses = await prisma.class.findMany({
    where: { type: "Lunch" },
    select: { id: true, programId: true, semester: true, startTime: true, endTime: true },
  });

  let breaksCreated = 0;
  for (const slot of lunchClasses) {
    const existing = await prisma.break.findUnique({
      where: { programId_semester: { programId: slot.programId, semester: slot.semester } },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.break.create({
      data: {
        programId: slot.programId,
        semester: slot.semester,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });
    breaksCreated += 1;
  }

  // 2) Delete the legacy lunch class rows and anything hanging off them.
  const classIds = lunchClasses.map((c) => c.id);
  if (classIds.length > 0) {
    await prisma.attendanceRecord.deleteMany({
      where: { session: { classId: { in: classIds } } },
    });
    await prisma.attendanceSession.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.studyMaterialClass.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.class.deleteMany({ where: { id: { in: classIds } } });
  }

  // 3) Remove the pseudo-subject and its teacher assignments.
  const lunchSubjects = await prisma.subject.findMany({
    where: { code: LUNCH_SUBJECT_CODE },
    select: { id: true },
  });
  const subjectIds = lunchSubjects.map((s) => s.id);
  if (subjectIds.length > 0) {
    await prisma.subjectTeacher.deleteMany({ where: { subjectId: { in: subjectIds } } });
    await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
  }

  console.log(
    `✅ Lunch→Break migration complete: ${breaksCreated} break(s) created, ` +
      `${classIds.length} legacy lunch class row(s) removed, ` +
      `${subjectIds.length} pseudo-subject row(s) removed.`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());