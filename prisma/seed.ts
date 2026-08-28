import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type DayOfWeek } from "../app/generated/prisma/client";
import bctCurriculum from "../app/data/curriculum/bct.json";
import { syncSubjectsFromCurriculum } from "../app/lib/curriculum-sync";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const parseTime = (timeStr: string) => {
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
};

async function main() {
  console.log("🌱 Starting database seeding...");

  // ─── Programs ───────────────────────────────────────────────
  const bct = await prisma.program.upsert({
    where: { code: "BCT" },
    update: {},
    create: { name: "B.E. Degree in Computer Engineering", code: "BCT", durationYears: 4, departmentName: "Engineering" },
  });
  await prisma.program.upsert({
    where: { code: "BCE" },
    update: {},
    create: { name: "Civil", code: "BCE", durationYears: 4, departmentName: "Engineering" },
  });
  await prisma.program.upsert({
    where: { code: "BE. ARCH" },
    update: {},
    create: { name: "Architecture", code: "BE. ARCH", durationYears: 4, departmentName: "Engineering" },
  });
    console.log("✅ Programs: BCT, BCE, BE ARCH");

  // ─── Users ──────────────────────────────────────────────────
  const adminHash = await hash("admin1234", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fwu.edu.np" },
    update: {},
    create: { email: "admin@fwu.edu.np", passwordHash: adminHash, firstName: "Admin", lastName: "User", role: "ADMIN" },
  });

  const teacherHash = await hash("teacher1234", 12);
  const teachersInfo = [
    { email: "kl@fwu.edu.np", fn: "Kamal", ln: "Lekhak", empNo: "FWU-EMP-203" },
    { email: "rkb@fwu.edu.np", fn: "Rohit", ln: "Bist", empNo: "FWU-EMP-206" },
    { email: "bsd@fwu.edu.np", fn: "Birendra Singh", ln: "Dhami", empNo: "FWU-EMP-204" },
    { email: "gpl@fwu.edu.np", fn: "Guru Prasad", ln: "Lekhak", empNo: "FWU-EMP-205" },
    { email: "pdb@fwu.edu.np", fn: "P. D.", ln: "Bhatta", empNo: "FWU-EMP-202" },
    { email: "bp@fwu.edu.np", fn: "B", ln: "P", empNo: "FWU-EMP-201" },
  ];

  const teacherMap: Record<string, string> = {};
  for (const t of teachersInfo) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        email: t.email,
        passwordHash: teacherHash,
        firstName: t.fn,
        lastName: t.ln,
        role: "TEACHER",
        teacher: { create: { employeeNo: t.empNo } },
      },
    });
    const teacher = await prisma.teacher.findUnique({ where: { userId: u.id } });
    if (teacher) teacherMap[t.email] = teacher.id;
  }

  const studentHash = await hash("student1234", 12);
  const studentsInfo = [
    { email: "aryan@fwu.edu.np", fn: "Aryan", ln: "Bhatta", enroll: "80BCT01" },
    { email: "sugam@fwu.edu.np", fn: "Sugam", ln: "Dhami", enroll: "80BCT38" },
    { email: "umesh@fwu.edu.np", fn: "Umesh Raj", ln: "Upadhyay", enroll: "80BCT42" },
  ];

  const studentMap: Record<string, string> = {};
  for (const s of studentsInfo) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: studentHash,
        firstName: s.fn,
        lastName: s.ln,
        role: "STUDENT",
      },
    });
    const student = await prisma.student.upsert({
      where: { userId: u.id },
      update: { currentSemester: 6, programId: bct.id },
      create: {
        userId: u.id,
        enrollmentNumber: s.enroll,
        registrationId: `REG-${s.enroll}`,
        admissionDate: new Date("2023-09-15"),
        programId: bct.id,
        currentSemester: 6,
      },
    });
    studentMap[s.email] = student.id;
  }
    console.log("✅ Users: admin, 6 teachers, 3 students");

    // ─── Curriculum ─────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    await tx.result.deleteMany({});
    await tx.assessment.deleteMany({ where: { programId: bct.id } });
    await tx.class.deleteMany({ where: { programId: bct.id } }); // cascades attendance sessions & records
    await tx.subject.deleteMany({ where: { programId: bct.id } });
    await tx.curriculum.deleteMany({ where: { programId: bct.id } });
  });

  // Create BCT curriculum from JSON
  const yearsRaw = (bctCurriculum as { years: Array<{ year: string; semesters: Array<{ semester: string; credits: number; courses: Array<{ code: string | null; name: string; credits: number }> }> }> }).years;
  const electivesRaw = (bctCurriculum as { electives: Record<string, Array<{ code: string; name: string; credits: number }>> }).electives;

  let globalSemNo = 0;
  await prisma.$transaction(async (tx) => {
    await tx.curriculum.create({
      data: {
        programId: bct.id,
        years: {
          create: yearsRaw.map((y, yi) => ({
            yearNo: yi + 1,
            label: y.year,
            semesters: {
              create: y.semesters.map((sem) => {
                globalSemNo += 1;
                return {
                  semesterNo: globalSemNo,
                  label: sem.semester,
                  courses: {
                    create: sem.courses
                      .filter((c) => c.code != null)
                      .map((c, ci) => ({ code: c.code!, name: c.name, credits: c.credits, sortOrder: ci })),
                  },
                };
              }),
            },
          })),
        },
        electives: {
          create: Object.entries(electivesRaw).flatMap(([group, courses]) =>
            courses.map((c, ei) => ({
              group: group === "electiveI" ? "ELECTIVE_I" : "ELECTIVE_II",
              code: c.code,
              name: c.name,
              credits: c.credits,
              sortOrder: ei,
            })),
          ),
        },
      },
    });
  });
  await syncSubjectsFromCurriculum(prisma, bct.id);
  console.log("✅ Curriculum & subjects synced");

  // Add practical lab subjects (not part of the JSON theory curriculum)
  const practicalDefs = [
    { code: "CT 364-P", name: "Database Management System Practical" },
    { code: "EX 365-P", name: "Communication System Practical" },
    { code: "CT 363-P", name: "Artificial Intelligence Practical" },
  ];
  for (const p of practicalDefs) {
    await prisma.subject.upsert({
      where: { code: p.code },
      update: { name: p.name, programId: bct.id, semester: 6 },
      create: { code: p.code, name: p.name, programId: bct.id, semester: 6 },
    });
  }

  // ─── Classes ────────────────────────────────────────────────
  const subjects = await prisma.subject.findMany({ where: { programId: bct.id }, select: { id: true, code: true } });
  const sub = (code: string) => subjects.find((s) => s.code === code)?.id ?? "";
  const tch = (email: string) => teacherMap[email] ?? "";

  const dow: Record<string, DayOfWeek> = { Mon: "MONDAY", Tue: "TUESDAY", Wed: "WEDNESDAY", Thu: "THURSDAY", Fri: "FRIDAY", Sat: "SATURDAY" };

  const classDefs: Array<{
    d: DayOfWeek; t: string; subj?: string | null; tchEmail?: string | null; type?: string; group?: string;
    parallel?: { subj: string; tch: string; group: string }[];
  }> = [
    // Monday
    { d: dow.Mon, t: "09:00-10:00", subj: "CT 367", tchEmail: null, type: "Lecture" },
    { d: dow.Mon, t: "10:00-11:00", subj: "SH 366", tchEmail: "bp@fwu.edu.np", type: "Lecture" },
    { d: dow.Mon, t: "11:00-12:00", subj: "CT 362", tchEmail: "pdb@fwu.edu.np", type: "Lecture" },
    { d: dow.Mon, t: "12:00-13:00", subj: "EX 365", tchEmail: "kl@fwu.edu.np", type: "Lecture" },
    { d: dow.Mon, t: "13:30-14:30", subj: "CT 363", tchEmail: "gpl@fwu.edu.np", type: "Lecture" },
    { d: dow.Mon, t: "14:30-15:30", subj: "CT 361", tchEmail: "bsd@fwu.edu.np", type: "Lecture" },
    { d: dow.Mon, t: "14:30-16:00", subj: "CT 364-P", tchEmail: "rkb@fwu.edu.np", type: "Practical", group: "Gr. B" },
    // Tuesday
    { d: dow.Tue, t: "09:00-10:00", subj: "CT 367", tchEmail: null, type: "Lecture" },
    { d: dow.Tue, t: "10:00-11:00", subj: "SH 366", tchEmail: "bp@fwu.edu.np", type: "Lecture" },
    { d: dow.Tue, t: "11:00-12:00", subj: "CT 362", tchEmail: "pdb@fwu.edu.np", type: "Lecture" },
    { d: dow.Tue, t: "12:00-13:00", subj: "EX 365", tchEmail: "kl@fwu.edu.np", type: "Lecture" },
    { d: dow.Tue, t: "13:30-14:30", subj: "CT 363", tchEmail: "gpl@fwu.edu.np", type: "Lecture" },
    { d: dow.Tue, t: "14:30-15:30", subj: "CT 364", tchEmail: "rkb@fwu.edu.np", type: "Lecture" },
    // Wednesday
    { d: dow.Wed, t: "09:00-10:00", subj: "CT 367", tchEmail: null, type: "Lecture" },
    { d: dow.Wed, t: "10:00-11:00", subj: "CT 364", tchEmail: "rkb@fwu.edu.np", type: "Lecture" },
    { d: dow.Wed, t: "11:00-12:00", subj: "CT 362", tchEmail: "pdb@fwu.edu.np", type: "Lecture" },
    { d: dow.Wed, t: "12:00-13:00", subj: "CT 361", tchEmail: "bsd@fwu.edu.np", type: "Lecture" },
    { d: dow.Wed, t: "13:30-14:30", subj: "CT 363", tchEmail: "gpl@fwu.edu.np", type: "Lecture" },
    { d: dow.Wed, t: "14:30-16:00", parallel: [
      { subj: "EX 365-P", tch: "kl@fwu.edu.np", group: "Gr. A" },
      { subj: "CT 363-P", tch: "gpl@fwu.edu.np", group: "Gr. B" },
    ] },
    // Thursday
    { d: dow.Thu, t: "09:00-10:00", subj: "CT 364", tchEmail: "rkb@fwu.edu.np", type: "Lecture" },
    { d: dow.Thu, t: "10:00-11:00", subj: "SH 366", tchEmail: "bp@fwu.edu.np", type: "Lecture" },
    { d: dow.Thu, t: "11:00-12:00", subj: "EX 365", tchEmail: "kl@fwu.edu.np", type: "Lecture" },
    { d: dow.Thu, t: "12:00-13:00", subj: "CT 361", tchEmail: "bsd@fwu.edu.np", type: "Lecture" },
    { d: dow.Thu, t: "13:30-14:30", subj: "CT 363", tchEmail: "gpl@fwu.edu.np", type: "Lecture" },
    { d: dow.Thu, t: "14:30-16:00", parallel: [
      { subj: "EX 365-P", tch: "kl@fwu.edu.np", group: "Gr. B" },
      { subj: "CT 363-P", tch: "gpl@fwu.edu.np", group: "Gr. A" },
    ] },
    // Friday
    { d: dow.Fri, t: "09:00-10:00", subj: "CT 364", tchEmail: "rkb@fwu.edu.np", type: "Lecture" },
    { d: dow.Fri, t: "10:00-11:00", subj: "SH 366", tchEmail: "bp@fwu.edu.np", type: "Lecture" },
    { d: dow.Fri, t: "11:00-12:00", subj: "EX 365", tchEmail: "kl@fwu.edu.np", type: "Lecture" },
    { d: dow.Fri, t: "12:00-13:00", subj: "CT 361", tchEmail: "bsd@fwu.edu.np", type: "Lecture" },
    { d: dow.Fri, t: "13:30-14:30", subj: "CT 363", tchEmail: "gpl@fwu.edu.np", type: "Lecture" },
    { d: dow.Fri, t: "14:30-16:00", subj: "CT 364-P", tchEmail: "rkb@fwu.edu.np", type: "Practical", group: "Gr. A" },
  ];

  await prisma.$transaction(async (tx) => {
    for (const c of classDefs) {
      const [start, end] = c.t.split("-");
      if (c.parallel) {
        for (const p of c.parallel) {
          await tx.class.create({
            data: {
              programId: bct.id,
              semester: 6,
              dayOfWeek: c.d,
              startTime: parseTime(start),
              endTime: parseTime(end),
              subjectId: sub(p.subj),
              teacherId: tch(p.tch),
              type: "Practical",
              group: p.group,
            },
          });
        }
      } else {
        // Real teaching slot. Break/Free placeholders are never stored as classes
        // (Class.subjectId & Class.teacherId are required by the schema).
        if (!c.subj) continue;
        await tx.class.create({
          data: {
            programId: bct.id,
            semester: 6,
            dayOfWeek: c.d,
            startTime: parseTime(start),
            endTime: parseTime(end),
            subjectId: sub(c.subj),
            // Slots without an assigned instructor (e.g. Minor Project) fall back
            // to the semester coordinator as a placeholder supervisor.
            teacherId: tch(c.tchEmail ?? "kl@fwu.edu.np"),
            type: c.type ?? "Lecture",
            group: c.group ?? null,
          },
        });
      }
    }
  });
    console.log("✅ Classes seeded (Sem 6 schedule)");

    // ─── Assessments ────────────────────────────────────────────
  const dbSub = await prisma.subject.findUnique({ where: { code: "CT 364" } });
  const existingAssessment = await prisma.assessment.findUnique({
    where: { subjectId_semester_name: { subjectId: dbSub!.id, semester: 6, name: "Mid-Term Examination" } },
  });
  const a1 = existingAssessment ?? await prisma.assessment.create({
    data: {
      programId: bct.id,
      semester: 6,
      subjectId: dbSub!.id,
      name: "Mid-Term Examination",
      maxMarks: 50,
      assessmentDate: new Date("2026-08-18"),
    },
  });
  console.log("✅ Assessments created");

  // ─── Results ────────────────────────────────────────────────
  const allStudents = await prisma.student.findMany({
    where: { enrollmentNumber: { in: ["80BCT01", "80BCT38", "80BCT42"] } },
    select: { id: true, enrollmentNumber: true },
  });
  for (const s of allStudents) {
    const marks = s.enrollmentNumber === "80BCT42" ? 44.5 : s.enrollmentNumber === "80BCT38" ? 48.0 : 42.0;
    const grade = s.enrollmentNumber === "80BCT42" ? "A" : s.enrollmentNumber === "80BCT38" ? "A+" : "B+";
    const existingResult = await prisma.result.findUnique({
      where: { assessmentId_studentId: { assessmentId: a1.id, studentId: s.id } },
    });
    if (!existingResult) {
      await prisma.result.create({
        data: { assessmentId: a1.id, studentId: s.id, marks, grade },
      });
    }
  }
  console.log("✅ Results recorded");

  // ─── Notes / Study Materials samples ────────────────────────
  const materialCount = await prisma.studyMaterial.count();
  if (materialCount === 0) {
    const uploader = await prisma.user.findUnique({
      where: { email: "kl@fwu.edu.np" },
      select: { id: true },
    });
    const bctSubjects = await prisma.subject.findMany({
      where: { programId: bct.id },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
      take: 4,
    });

    if (uploader && bctSubjects.length > 0) {
      const sampleMaterials = [
        {
          title: `${bctSubjects[0].name} — Unit 1 Classroom Notes`,
          description: "Handwritten-to-digital lecture notes covering foundational concepts, solved examples and revision pointers.",
          topic: bctSubjects[0].name,
          materialType: "LECTURE_NOTES" as const,
          visibility: "EVERYONE" as const,
          departmentName: null,
          programId: null,
          semester: null,
          subjectId: bctSubjects[0].id,
          fileName: `${bctSubjects[0].code.toLowerCase()}-unit1-notes.md`,
          body: `# ${bctSubjects[0].name} — Unit 1 Notes\n\nThis unit introduces the core building blocks of ${bctSubjects[0].name}.\n\n- Key definitions and notation\n- Worked examples from class\n- Revision checklist\n\n_Auto-seeded demo study material._\n`,
        },
        {
          title: `${bctSubjects[Math.min(3, bctSubjects.length - 1)].name} — Question Bank (Exam Prep)`,
          description: "Collected past questions organised chapter-wise for semester exam preparation.",
          topic: "Question Bank",
          materialType: "QUESTION_BANK" as const,
          visibility: "DEPARTMENT_PROGRAM" as const,
          departmentName: "Engineering",
          programId: bct.id,
          semester: bctSubjects[Math.min(3, bctSubjects.length - 1)].semester,
          subjectId: bctSubjects[Math.min(3, bctSubjects.length - 1)].id,
          fileName: "question-bank.md",
          body: "# Question Bank\n\nChapter-wise collection of long and short questions.\n\n1. Define and classify …\n2. Explain the working principle of …\n3. Derive the expression for …\n",
        },
        {
          title: "Semester Startup Kit — Study Plan & References",
          description: "General reference pack for new students: weekly study plan format, recommended references and library pointers.",
          topic: "Study Skills",
          materialType: "REFERENCE_MATERIAL" as const,
          visibility: "EVERYONE" as const,
          departmentName: null,
          programId: bct.id,
          semester: 3,
          subjectId: null,
          fileName: "semester-startup-kit.md",
          body: "# Semester Startup Kit\n\nA college-wide reference everyone can access — surfaced automatically to Semester 3 students.\n\n## Weekly Study Planner\n\n| Day | Focus | Hours |\n| --- | ----- | ----- |\n| Mon | Theory revision | 2 |\n| Wed | Lab practice | 2 |\n| Fri | Assignment work | 2 |\n",
        },
      ];

      for (const m of sampleMaterials) {
        const bytes = Buffer.from(m.body, "utf8");
        await prisma.studyMaterial.create({
          data: {
            title: m.title,
            description: m.description,
            topic: m.topic,
            materialType: m.materialType,
            visibility: m.visibility,
            departmentName: m.departmentName,
            programId: m.programId,
            semester: m.semester,
            subjectId: m.subjectId,
            fileName: m.fileName,
            mimeType: "text/markdown",
            fileSize: bytes.byteLength,
            fileData: bytes,
            uploaderId: uploader.id,
          },
        });
      }
      console.log("✅ Sample study materials created");
    }
  }


  // ─── Announcements ─────────────────────────────────────────
  // 1×1 transparent PNG used as a sample notice attachment (previewable image).
  const noticeImage = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  const announcements: Array<{
    title: string;
    body: string;
    attachmentFileName?: string;
    attachmentMimeType?: string;
    attachmentData?: Uint8Array<ArrayBuffer>;
  }> = [
    { title: "Far Western University Academic Year 2026 Session Commences", body: "All students and faculty members are informed that regular academic coursework and laboratory sessions for the Fall 2026 semester have officially commenced. Attendance will be recorded digitally on the College ERP portal." },
    {
      title: "Library and Digital Resource Access Pass Distribution",
      body: "Students can collect their RFID library credentials and institutional access cards from the administrative front desk starting this Friday between 10:00 AM and 4:00 PM.",
      attachmentFileName: "library-access-pass.png",
      attachmentMimeType: "image/png",
      attachmentData: noticeImage,
    },
    { title: "Call for Papers: National Engineering & IT Symposium 2026", body: "The Department of Computer & Electronics Engineering invites research papers and capstone project submissions for the upcoming National Engineering Symposium. Cash prizes and publication certificates will be awarded." },
    { title: "Semester Examination Schedule & Form Submission Deadline", body: "Examination registration forms for the upcoming semester finals must be submitted to the examination department by the end of next week along with cleared dues." },
  ];
  for (const a of announcements) {
    await prisma.announcement.create({
      data: {
        title: a.title,
        body: a.body,
        authorId: adminUser.id,
        publishedAt: new Date(),
        ...(a.attachmentData
          ? {
              attachmentFileName: a.attachmentFileName,
              attachmentMimeType: a.attachmentMimeType,
              attachmentSize: a.attachmentData.byteLength,
              attachmentData: a.attachmentData,
            }
          : {}),
      },
    });
  }
  console.log("✅ Announcements created");

  console.log("\n🎉 Seeding complete!\n");
  console.log("─────────────────────────────────────────────");
  console.log("Login Credentials:");
  console.log("• Admin:   admin@fwu.edu.np   / admin1234");
  console.log("• Teacher: kl@fwu.edu.np     / teacher1234  (Kamal Lekhak)");
  console.log("• Teacher: rkb@fwu.edu.np    / teacher1234  (Rohit Bist)");
  console.log("• Teacher: bsd@fwu.edu.np    / teacher1234  (Birendra Singh)");
  console.log("• Teacher: gpl@fwu.edu.np    / teacher1234  (Guru Prasad)");
  console.log("• Teacher: pdb@fwu.edu.np    / teacher1234  (P.D. Bhatta)");
  console.log("• Teacher: bp@fwu.edu.np     / teacher1234  (B.P.)");
  console.log("• Student: aryan@fwu.edu.np  / student1234  (80BCT01)");
  console.log("• Student: sugam@fwu.edu.np  / student1234  (80BCT38)");
  console.log("• Student: umesh@fwu.edu.np  / student1234  (80BCT42)");
  console.log("─────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });