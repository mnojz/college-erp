import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type RosterEntry = { roll: number; registration: string; name: string };

/** Roster supplied for the Computer program, 6th semester. */
const ROSTER: RosterEntry[] = [
  { roll: 1, registration: "EG-2024-1-1-0725", name: "AARYAN BHATT" },
  { roll: 2, registration: "EG-2024-1-1-0726", name: "ABHISEK DAUDE" },
  { roll: 3, registration: "EG-2024-1-1-0727", name: "ALINA KATHAYAT" },
  { roll: 4, registration: "EG-2024-1-1-0728", name: "ASISH MEHATA" },
  { roll: 5, registration: "EG-2024-1-1-0729", name: "BASANT CHAND" },
  { roll: 6, registration: "EG-2024-1-1-0730", name: "BASANT SINGH BHAT" },
  { roll: 7, registration: "EG-2024-1-1-0731", name: "BIMALA PANERU" },
  { roll: 8, registration: "EG-2024-1-1-0732", name: "BIPANA DHAMI" },
  { roll: 9, registration: "EG-2024-1-1-0733", name: "BIRENDRA BOHARA" },
  { roll: 10, registration: "EG-2024-1-1-0734", name: "DAMMAR RAJ JOSHI" },
  { roll: 11, registration: "EG-2024-1-1-0735", name: "GOMATI BADU" },
  { roll: 12, registration: "EG-2024-1-1-0736", name: "GRESH AWASTHI" },
  { roll: 13, registration: "EG-2024-1-1-0737", name: "HEMANT LEKHAK" },
  { roll: 14, registration: "EG-2024-1-1-0738", name: "HEMALATA JOSHI" },
  { roll: 15, registration: "EG-2024-1-1-0739", name: "JEEBAN BOHARA" },
  { roll: 16, registration: "EG-2024-1-1-0740", name: "JELINA BHATT" },
  { roll: 17, registration: "EG-2024-1-1-0741", name: "JYOTI CHAND" },
  { roll: 18, registration: "EG-2024-1-1-0742", name: "KIRAN RIMAL JAISHI" },
  { roll: 19, registration: "EG-2024-1-1-0743", name: "LALIT PRASAD BHATT" },
  { roll: 20, registration: "EG-2024-1-1-0744", name: "MADHAB PRASHAD BHATT" },
  { roll: 21, registration: "EG-2024-1-1-0745", name: "MANISH PANDEY" },
  { roll: 22, registration: "EG-2024-1-1-0746", name: "MANOJ JOSHI" },
  { roll: 23, registration: "EG-2024-1-1-0747", name: "MANOJ SINGH BIST" },
  { roll: 24, registration: "EG-2024-1-1-0748", name: "MOHIT BHATT" },
  { roll: 25, registration: "EG-2024-1-1-0749", name: "NARENDRA BAHADUR CHAND" },
  { roll: 26, registration: "EG-2024-1-1-0750", name: "NITESH JOSHI" },
  { roll: 27, registration: "EG-2024-1-1-0751", name: "PANKAJ CHAND" },
  { roll: 28, registration: "EG-2024-1-1-0752", name: "PAWAN DHAMI" },
  { roll: 29, registration: "EG-2024-1-1-0753", name: "PAYASWINI PARIYAR" },
  { roll: 30, registration: "EG-2024-1-1-0754", name: "POOJA BHATT" },
  { roll: 31, registration: "EG-2024-1-1-0755", name: "PRADEEP NATH" },
  { roll: 32, registration: "EG-2024-1-1-0756", name: "PRASHANT SAUD" },
  { roll: 33, registration: "EG-2024-1-1-0757", name: "PRITAM RANA" },
  { roll: 34, registration: "EG-2024-1-1-0758", name: "RITIZ BOGATI" },
  { roll: 35, registration: "EG-2024-1-1-0759", name: "SAMIR SHAHU" },
  { roll: 36, registration: "EG-2024-1-1-0760", name: "SMRITI B. C" },
  { roll: 37, registration: "EG-2024-1-1-0761", name: "SUGAM DHAMI" },
  { roll: 38, registration: "EG-2024-1-1-0762", name: "SURESH AGRI" },
  { roll: 39, registration: "EG-2024-1-1-0763", name: "TEK RAJ BHATT" },
  { roll: 40, registration: "EG-2024-1-1-0764", name: "UJJAL SINGH MAHATA" },
  { roll: 41, registration: "EG-2024-1-1-0765", name: "UMESH RAJ UPADHYAY" },
];

/** The one account this script must never touch. */
const KEEP_ENROLLMENT = "80BCT43";
const PROGRAM_CODE = "BCT";
const CURRENT_SEMESTER = 6;
/**
 * A 4-year program's 6th semester is year 3, so a September 2024 intake lines
 * up with the current date and matches the demo account's Oct 2024 admission.
 */
const ADMISSION_DATE = new Date(Date.UTC(2024, 8, 15));
/** Shared dummy credential, same value the seed uses for student accounts. */
const PASSWORD = "student1234";
const EMAIL_DOMAIN = "fwu.edu.np";

/** "UMESH RAJ UPADHYAY" -> { first: "Umesh Raj", last: "Upadhyay" }. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) throw new Error(`Name needs a first and last part: ${full}`);
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName: cap(firstName), lastName: cap(lastName) };
}

function cap(s: string): string {
  return s.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

/** "SMRITI B. C" -> smriti.b.c@fwu.edu.np */
function emailFor(full: string): string {
  const slug = full.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return `${slug}@${EMAIL_DOMAIN}`;
}

function assertUnique(label: string, values: string[]): void {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) throw new Error(`Duplicate ${label} in roster: ${v}`);
    seen.add(v);
  }
}

async function main() {
  console.log("Replacing the Computer 6th-semester roster...");

  const program = await prisma.program.findUnique({
    where: { code: PROGRAM_CODE },
    select: { id: true, name: true, durationYears: true },
  });
  if (!program) throw new Error(`Program ${PROGRAM_CODE} not found`);

  // Roster sanity BEFORE any write: if these fail the DB is left untouched.
  assertUnique("roll", ROSTER.map((r) => String(r.roll)));
  assertUnique("registration", ROSTER.map((r) => r.registration));
  assertUnique("name", ROSTER.map((r) => r.name));
  const maxSem = program.durationYears * 2;
  if (CURRENT_SEMESTER > maxSem) {
    throw new Error(`Semester ${CURRENT_SEMESTER} exceeds program max ${maxSem}`);
  }

  const plan = ROSTER.map((entry) => {
    const { firstName, lastName } = splitName(entry.name);
    return {
      ...entry,
      firstName,
      lastName,
      email: emailFor(entry.name),
      // Follows the existing 80BCTNN convention; rolls 1-41 stay clear of the
      // kept demo record (80BCT43).
      enrollmentNumber: `80BCT${String(entry.roll).padStart(2, "0")}`,
      rollNumber: entry.roll,
    };
  });
  assertUnique("email", plan.map((p) => p.email));
  assertUnique("enrollment", plan.map((p) => p.enrollmentNumber));

  const passwordHash = await hash(PASSWORD, 12);

  const outcome = await prisma.$transaction(async (tx) => {
    // Delete FIRST: roll 1, roll 38, enrollments 80BCT01/38/42 and registration
    // ...0763 are all reused by the incoming roster, so creating before removing
    // would trip unique constraints.
    const doomed = await tx.student.findMany({
      where: { enrollmentNumber: { not: KEEP_ENROLLMENT } },
      select: { userId: true, enrollmentNumber: true, user: { select: { email: true } } },
    });
    const doomedUserIds = doomed.map((s) => s.userId);
    if (doomedUserIds.length > 0) {
      // Deleting the user cascades to Student, which in turn cascades to
      // attendance records, results and semester history.
      await tx.user.deleteMany({ where: { id: { in: doomedUserIds } } });
    }

    const existingEmails = new Set(
      (await tx.user.findMany({ select: { email: true } })).map((u) => u.email),
    );

    const created: { email: string; enrollment: string; roll: number }[] = [];
    for (const p of plan) {
      // Collision with a surviving account (admin, teachers, demo) - duplicates
      // within the roster were already ruled out above.
      let email = p.email;
      if (existingEmails.has(email)) {
        const head = p.firstName.toLowerCase().replace(/[^a-z0-9]+/g, "");
        email = `${head}.${p.roll}@${EMAIL_DOMAIN}`;
        if (existingEmails.has(email)) throw new Error(`Cannot resolve email for ${p.name}`);
      }
      existingEmails.add(email);

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: p.firstName,
          lastName: p.lastName,
          role: "STUDENT",
        },
        select: { id: true },
      });

      await tx.student.create({
        data: {
          userId: user.id,
          enrollmentNumber: p.enrollmentNumber,
          registrationId: p.registration,
          rollNumber: p.rollNumber,
          admissionDate: ADMISSION_DATE,
          programId: program.id,
          currentSemester: CURRENT_SEMESTER,
          nationality: "Nepali",
        },
      });

      created.push({ email, enrollment: p.enrollmentNumber, roll: p.rollNumber });
    }

    return { removed: doomed, created };
  });

  console.log(
    `Removed ${outcome.removed.length} old student(s): ` +
      outcome.removed.map((s) => `${s.enrollmentNumber} (${s.user.email})`).join(", "),
  );
  console.log(`Created ${outcome.created.length} student(s) in ${program.name}.`);
  console.log(`Shared password for every new account: ${PASSWORD}`);

  const total = await prisma.student.count();
  const kept = await prisma.student.findUnique({
    where: { enrollmentNumber: KEEP_ENROLLMENT },
    select: { id: true, user: { select: { email: true } } },
  });
  if (!kept) throw new Error("Demo student vanished - aborting report");
  console.log(`Students now in DB: ${total} (incl. kept ${KEEP_ENROLLMENT})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
