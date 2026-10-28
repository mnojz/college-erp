import "./load-env";
import { prisma } from "../app/lib/prisma";
import { gradeForMarks, gradePointForMarks } from "../app/lib/grading";

// Deterministic pseudo-random number generator seeded by string
function pseudoRandom(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
}

const SEMESTER_NAMES = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
];

async function main() {
  console.log("Starting exam restoration & marksheet generation...");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("No admin user found in database");
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });
  if (!academicYear) {
    throw new Error("No active academic year found in database");
  }

  // Target programs: BCT (up to sem 6) and BE. ARCH (up to sem 4)
  const programConfigs = [
    { code: "BCT", maxSem: 6 },
    { code: "BE. ARCH", maxSem: 4 },
  ];

  for (const config of programConfigs) {
    const program = await prisma.program.findFirst({
      where: { code: config.code },
      include: {
        students: {
          where: { status: "ACTIVE" },
          select: { id: true, enrollmentNumber: true, user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!program) {
      console.log(`Program ${config.code} not found, skipping.`);
      continue;
    }

    console.log(`\nProcessing ${program.name} (${program.code}) with ${program.students.length} students...`);

    for (let sem = 1; sem <= config.maxSem; sem++) {
      const subjects = await prisma.subject.findMany({
        where: { programId: program.id, semester: sem },
        orderBy: { code: "asc" },
      });

      if (subjects.length === 0) {
        console.log(`  No subjects for Semester ${sem}, skipping.`);
        continue;
      }

      // Base dates scaled by semester
      // Sem 6 is recent (Oct 2026), sem 1 is oldest (~2 years ago)
      const monthsAgo = (config.maxSem - sem) * 5;
      const baseDate = new Date();
      baseDate.setMonth(baseDate.getMonth() - monthsAgo);

      const routineDate = new Date(baseDate);
      routineDate.setDate(routineDate.getDate() - 25);

      const deadlineDate = new Date(baseDate);
      deadlineDate.setDate(deadlineDate.getDate() - 15);

      const resultsDate = new Date(baseDate);

      const semWord = SEMESTER_NAMES[sem - 1] || `${sem}th`;

      // We'll create END_SEMESTER for all semesters
      // And MID_TERM for the latest semester (or all semesters)
      const sessionTypes: Array<"END_SEMESTER" | "MID_TERM"> =
        sem === config.maxSem ? ["END_SEMESTER", "MID_TERM"] : ["END_SEMESTER"];

      for (const examType of sessionTypes) {
        const title =
          examType === "END_SEMESTER"
            ? `${program.code} ${semWord} Semester Final Examination 2081`
            : `${program.code} ${semWord} Semester Mid-Term Assessment 2081`;

        // Check if session already exists
        let session = await prisma.examSession.findUnique({
          where: {
            programId_semester_academicYearId_type: {
              programId: program.id,
              semester: sem,
              academicYearId: academicYear.id,
              type: examType,
            },
          },
        });

        if (!session) {
          session = await prisma.examSession.create({
            data: {
              programId: program.id,
              semester: sem,
              academicYearId: academicYear.id,
              type: examType,
              title,
              status: "RESULTS_PUBLISHED",
              routinePublishedAt: routineDate,
              routinePublishedBy: admin.id,
              registrationDeadline: deadlineDate,
              resultsPublishedAt: resultsDate,
              resultsPublishedBy: admin.id,
            },
          });
          console.log(`  Created ${examType} session: "${title}" (ID: ${session.id})`);
        } else {
          console.log(`  Session already exists: "${title}" (ID: ${session.id})`);
        }

        // Setup subjects & parts
        let routineOrder = 1;
        const examSubjectIds: string[] = [];

        for (const sub of subjects) {
          // Add routine entry
          const paperDate = new Date(routineDate);
          paperDate.setDate(paperDate.getDate() + (routineOrder - 1) * 3);

          const existingRoutine = await prisma.examRoutineEntry.findFirst({
            where: { sessionId: session.id, subjectId: sub.id },
          });
          if (!existingRoutine) {
            await prisma.examRoutineEntry.create({
              data: {
                sessionId: session.id,
                subjectId: sub.id,
                order: routineOrder++,
                date: paperDate,
              },
            });
          }

          // Determine parts
          const partsToCreate: Array<{ part: "THEORY" | "PRACTICAL"; maxMarks: number }> = [];

          if (examType === "END_SEMESTER") {
            if (sub.hasTheory) {
              partsToCreate.push({
                part: "THEORY",
                maxMarks: sub.hasPractical ? 60 : 100,
              });
            }
            if (sub.hasPractical) {
              partsToCreate.push({
                part: "PRACTICAL",
                maxMarks: sub.hasTheory ? 40 : 50,
              });
            }
          } else {
            // MID_TERM
            if (sub.hasTheory) {
              partsToCreate.push({
                part: "THEORY",
                maxMarks: 50,
              });
            }
            if (sub.hasPractical) {
              partsToCreate.push({
                part: "PRACTICAL",
                maxMarks: 25,
              });
            }
          }

          for (const p of partsToCreate) {
            let es = await prisma.examSubject.findUnique({
              where: {
                sessionId_subjectId_part: {
                  sessionId: session.id,
                  subjectId: sub.id,
                  part: p.part,
                },
              },
            });

            if (!es) {
              es = await prisma.examSubject.create({
                data: {
                  sessionId: session.id,
                  subjectId: sub.id,
                  part: p.part,
                  maxMarks: p.maxMarks,
                  marksPublishedAt: resultsDate,
                  marksPublishedBy: admin.id,
                },
              });
            }
            examSubjectIds.push(es.id);
          }
        }

        // Register students and enter marks
        const examSubjects = await prisma.examSubject.findMany({
          where: { sessionId: session.id },
          include: { subject: true },
        });

        console.log(`    Seeding marks for ${program.students.length} students across ${examSubjects.length} exam subject parts...`);

        for (const student of program.students) {
          for (const es of examSubjects) {
            // Register student
            await prisma.examRegistration.upsert({
              where: {
                examSubjectId_studentId: {
                  examSubjectId: es.id,
                  studentId: student.id,
                },
              },
              create: {
                examSubjectId: es.id,
                studentId: student.id,
              },
              update: {},
            });

            // Realistic marks generation:
            // Score between 70% and 95% of maxMarks based on student + subject seed
            const rnd = pseudoRandom(`${student.id}-${es.id}-${sem}`);
            // percentage between 72% and 94%
            const pct = 0.72 + rnd * 0.22;
            const max = Number(es.maxMarks);
            const rawMarks = Math.round(max * pct * 2) / 2; // half marks, e.g. 52.5

            const grade = gradeForMarks(rawMarks, max);
            const gradePoint = gradePointForMarks(rawMarks, max);

            await prisma.examMark.upsert({
              where: {
                examSubjectId_studentId: {
                  examSubjectId: es.id,
                  studentId: student.id,
                },
              },
              create: {
                examSubjectId: es.id,
                studentId: student.id,
                marks: rawMarks,
                grade,
                gradePoint,
                enteredBy: admin.id,
              },
              update: {
                marks: rawMarks,
                grade,
                gradePoint,
              },
            });
          }
        }
      }
    }
  }

  console.log("\n🎉 Exam restoration & marksheet generation complete!");
}

main()
  .catch((e) => {
    console.error("Error during exam seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

