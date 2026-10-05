import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * One-off merge: "CT 364-P" (… Practical) is NOT a separate subject. Practical
 * vs Lecture already lives on Class.type, so fold every -P subject back onto
 * its base subject and drop the duplicate row.
 *
 * Writes a full JSON backup BEFORE touching anything.
 */
async function main() {
  const practicals = await prisma.subject.findMany({
    where: { code: { endsWith: "-P" } },
    orderBy: { code: "asc" },
  });

  if (practicals.length === 0) {
    console.log("No -P subjects found. Nothing to merge.");
    return;
  }
  console.log(`Found ${practicals.length} duplicate practical subjects: ${practicals.map((p) => p.code).join(", ")}\n`);

  // ── 1. BACKUP ──────────────────────────────────────────────────────────────
  const backup = { createdAt: new Date().toISOString(), entries: [] as unknown[] };
  for (const p of practicals) {
    const baseCode = p.code.replace(/-P$/, "");
    backup.entries.push({
      practical: p,
      base: await prisma.subject.findUnique({ where: { code: baseCode } }),
      classes: await prisma.class.findMany({ where: { subjectId: p.id } }),
      subjectTeachers: await prisma.subjectTeacher.findMany({ where: { subjectId: p.id } }),
      studyMaterials: await prisma.studyMaterial.findMany({ where: { subjectId: p.id } }),
      assessments: await prisma.assessment.findMany({ where: { subjectId: p.id } }),
      announcements: await prisma.announcement.findMany({ where: { subjectId: p.id } }),
    });
  }
  const file = `prisma/_backup-practical-subjects-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`BACKUP written -> ${file}\n`);

  // ── 2. MERGE ───────────────────────────────────────────────────────────────
  for (const p of practicals) {
    const baseCode = p.code.replace(/-P$/, "");
    const base = await prisma.subject.findUnique({ where: { code: baseCode } });
    console.log(`--- ${p.code}  ->  ${baseCode} ---`);

    if (!base) { console.log("  SKIP: base subject does not exist\n"); continue; }
    if (base.programId !== p.programId || base.semester !== p.semester) {
      console.log(`  SKIP: base differs (program match=${base.programId === p.programId}, semester ${base.semester} vs ${p.semester})\n`);
      continue;
    }

    // 2a. Teacher assignments first — @@unique([subjectId, teacherId]) would
    //     throw if the teacher is already on the base subject.
    const baseTeachers = await prisma.subjectTeacher.findMany({ where: { subjectId: base.id } });
    const pTeachers = await prisma.subjectTeacher.findMany({ where: { subjectId: p.id } });
    let movedT = 0, dedupedT = 0;
    for (const t of pTeachers) {
      if (baseTeachers.some((b) => b.teacherId === t.teacherId)) {
        await prisma.subjectTeacher.delete({ where: { id: t.id } });
        dedupedT += 1;
      } else {
        await prisma.subjectTeacher.update({ where: { id: t.id }, data: { subjectId: base.id } });
        movedT += 1;
      }
    }
    console.log(`  teacher assignments: ${movedT} moved, ${dedupedT} deduped (already on base)`);

    // 2b. Assessments — @@unique([subjectId, semester, name]) needs a guard.
    const pAssess = await prisma.assessment.findMany({ where: { subjectId: p.id } });
    let movedA = 0, renamedA = 0;
    for (const a of pAssess) {
      const clash = await prisma.assessment.findFirst({
        where: { subjectId: base.id, semester: a.semester, name: a.name, NOT: { id: a.id } },
      });
      if (clash) {
        await prisma.assessment.update({
          where: { id: a.id },
          data: { subjectId: base.id, name: `${a.name} (Practical)` },
        });
        renamedA += 1;
      } else {
        await prisma.assessment.update({ where: { id: a.id }, data: { subjectId: base.id } });
        movedA += 1;
      }
    }
    console.log(`  assessments: ${movedA} moved, ${renamedA} moved + renamed (name clash)`);

    // 2c. The rest — Class.type is preserved, so practical slots stay practical.
    const classes = await prisma.class.updateMany({ where: { subjectId: p.id }, data: { subjectId: base.id } });
    const materials = await prisma.studyMaterial.updateMany({ where: { subjectId: p.id }, data: { subjectId: base.id } });
    const announcements = await prisma.announcement.updateMany({ where: { subjectId: p.id }, data: { subjectId: base.id } });
    console.log(`  classes: ${classes.count} repointed (type preserved) | materials: ${materials.count} | announcements: ${announcements.count}`);

    await prisma.subject.delete({ where: { id: p.id } });
    console.log(`  DELETED ${p.code}\n`);
  }

  const left = await prisma.subject.count({ where: { code: { endsWith: "-P" } } });
  console.log(`Remaining -P subjects: ${left}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
