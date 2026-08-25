import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log("🌱 Starting rich database seeding...");

  // 1. Create Admin User
  const adminPasswordHash = await hash("admin1234", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fwu.edu.np" },
    update: {},
    create: {
      email: "admin@fwu.edu.np",
      passwordHash: adminPasswordHash,
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
    },
  });
  console.log("✅ Admin user:", adminUser.email);

  // 2. Create Programs
  const bctProgram = await prisma.program.upsert({
    where: { code: "BCT" },
    update: {},
    create: {
      name: "Bachelor in Computer Engineering",
      code: "BCT",
      durationYears: 4,
      departmentName: "Department of Computer & Electronics Engineering",
    },
  });

  const bcaProgram = await prisma.program.upsert({
    where: { code: "BCA" },
    update: {},
    create: {
      name: "Bachelor in Computer Applications",
      code: "BCA",
      durationYears: 3,
      departmentName: "Department of Computer Science & Information Technology",
    },
  });
  console.log("✅ Programs created: BCT (4 yrs/8 sems), BCA (3 yrs/6 sems)");

  // 3. Create Teachers
  const teacherPasswordHash = await hash("teacher1234", 12);

  const teacherUser1 = await prisma.user.upsert({
    where: { email: "teacher@fwu.edu.np" },
    update: {},
    create: {
      email: "teacher@fwu.edu.np",
      passwordHash: teacherPasswordHash,
      firstName: "Dr. Ramesh",
      lastName: "Sharma",
      role: "TEACHER",
    },
  });
  const teacher1 = await prisma.teacher.upsert({
    where: { userId: teacherUser1.id },
    update: {},
    create: { userId: teacherUser1.id, employeeNo: "FWU-EMP-101" },
  });

  const teacherUser2 = await prisma.user.upsert({
    where: { email: "priya@fwu.edu.np" },
    update: {},
    create: {
      email: "priya@fwu.edu.np",
      passwordHash: teacherPasswordHash,
      firstName: "Dr. Priya",
      lastName: "Thapa",
      role: "TEACHER",
    },
  });
  const teacher2 = await prisma.teacher.upsert({
    where: { userId: teacherUser2.id },
    update: {},
    create: { userId: teacherUser2.id, employeeNo: "FWU-EMP-102" },
  });

  const teacherUser3 = await prisma.user.upsert({
    where: { email: "anil@fwu.edu.np" },
    update: {},
    create: {
      email: "anil@fwu.edu.np",
      passwordHash: teacherPasswordHash,
      firstName: "Mr. Anil",
      lastName: "Karki",
      role: "TEACHER",
    },
  });
  const teacher3 = await prisma.teacher.upsert({
    where: { userId: teacherUser3.id },
    update: {},
    create: { userId: teacherUser3.id, employeeNo: "FWU-EMP-103" },
  });
  console.log("✅ 3 Teachers created: Dr. Ramesh Sharma, Dr. Priya Thapa, Mr. Anil Karki");

  // 4. Create Students
  const studentPasswordHash = await hash("student1234", 12);

  const studentDefs = [
    {
      email: "student@fwu.edu.np",
      firstName: "Aayush",
      lastName: "Adhikari",
      enrollment: "2024-BCT-01",
      regId: "REG-2024-001",
      roll: "01",
      programId: bctProgram.id,
      semester: 6,
    },
    {
      email: "sneha@fwu.edu.np",
      firstName: "Sneha",
      lastName: "Bhandari",
      enrollment: "2024-BCT-02",
      regId: "REG-2024-002",
      roll: "02",
      programId: bctProgram.id,
      semester: 6,
    },
    {
      email: "ram@fwu.edu.np",
      firstName: "Ram",
      lastName: "Bahadur",
      enrollment: "2024-BCT-03",
      regId: "REG-2024-003",
      roll: "03",
      programId: bctProgram.id,
      semester: 3,
    },
    {
      email: "hari@fwu.edu.np",
      firstName: "Hari",
      lastName: "Prasad",
      enrollment: "2024-BCT-04",
      regId: "REG-2024-004",
      roll: "04",
      programId: bctProgram.id,
      semester: 1,
    },
    {
      email: "bibek@fwu.edu.np",
      firstName: "Bibek",
      lastName: "Thapa",
      enrollment: "2024-BCT-05",
      regId: "REG-2024-005",
      roll: "05",
      programId: bctProgram.id,
      semester: 5,
    },
    {
      email: "sita@fwu.edu.np",
      firstName: "Sita",
      lastName: "Rai",
      enrollment: "2024-BCA-01",
      regId: "REG-2024-101",
      roll: "11",
      programId: bcaProgram.id,
      semester: 4,
    },
    {
      email: "maya@fwu.edu.np",
      firstName: "Maya",
      lastName: "Gurung",
      enrollment: "2024-BCA-02",
      regId: "REG-2024-102",
      roll: "12",
      programId: bcaProgram.id,
      semester: 2,
    },
    {
      email: "anita@fwu.edu.np",
      firstName: "Anita",
      lastName: "Sharma",
      enrollment: "2024-BCA-03",
      regId: "REG-2024-103",
      roll: "13",
      programId: bcaProgram.id,
      semester: 4,
    },
  ];

  const students = [];
  for (const s of studentDefs) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: studentPasswordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        role: "STUDENT",
      },
    });

    const student = await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        programId: s.programId,
        currentSemester: s.semester,
      },
      create: {
        userId: user.id,
        enrollmentNumber: s.enrollment,
        registrationId: s.regId,
        rollNumber: s.roll,
        admissionDate: new Date("2024-08-15"),
        programId: s.programId,
        currentSemester: s.semester,
        programEnrollmentStatus: "ENROLLED",
      },
    });
    students.push(student);
  }
  console.log(`✅ ${students.length} Students created across BCT & BCA`);

  // 5. Create Subjects
  const subjectDefs = [
    // BCT Subjects
    { name: "Structured Programming in C", code: "BCT101", programId: bctProgram.id, semester: 1 },
    { name: "Digital Logic & Circuit Design", code: "BCT102", programId: bctProgram.id, semester: 1 },
    { name: "Data Structures & Algorithms", code: "BCT301", programId: bctProgram.id, semester: 3 },
    { name: "Computer Architecture", code: "BCT302", programId: bctProgram.id, semester: 3 },
    { name: "Operating Systems", code: "BCT501", programId: bctProgram.id, semester: 5 },
    { name: "Computer Networks", code: "BCT502", programId: bctProgram.id, semester: 5 },
    { name: "Database Management Systems", code: "BCT601", programId: bctProgram.id, semester: 6 },
    { name: "Software Engineering & Project", code: "BCT602", programId: bctProgram.id, semester: 6 },

    // BCA Subjects
    { name: "Fundamentals of IT", code: "BCA101", programId: bcaProgram.id, semester: 1 },
    { name: "C Programming & Labs", code: "BCA102", programId: bcaProgram.id, semester: 1 },
    { name: "Object Oriented Programming Java", code: "BCA201", programId: bcaProgram.id, semester: 2 },
    { name: "Web Technologies & UI Design", code: "BCA202", programId: bcaProgram.id, semester: 2 },
    { name: "Database Systems with SQL", code: "BCA401", programId: bcaProgram.id, semester: 4 },
    { name: "Cloud Computing & DevOps", code: "BCA402", programId: bcaProgram.id, semester: 4 },
  ];

  const createdSubjects = new Map<string, { id: string; name: string; code: string; programId: string; semester: number }>();
  for (const sub of subjectDefs) {
    const s = await prisma.subject.upsert({
      where: { code: sub.code },
      update: { programId: sub.programId, semester: sub.semester, name: sub.name },
      create: sub,
    });
    createdSubjects.set(sub.code, s);
  }
  console.log(`✅ ${createdSubjects.size} Subjects created`);

  // 6. Create Classes
  const classDefs = [
    // Dr. Ramesh Sharma teaches DBMS (BCT601) and DB Systems (BCA401)
    {
      subjectCode: "BCT601",
      teacherId: teacher1.id,
      programId: bctProgram.id,
      semester: 6,
      dayOfWeek: "MONDAY" as const,
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T10:30:00.000Z"),
    },
    {
      subjectCode: "BCT601",
      teacherId: teacher1.id,
      programId: bctProgram.id,
      semester: 6,
      dayOfWeek: "WEDNESDAY" as const,
      startTime: new Date("1970-01-01T11:00:00.000Z"),
      endTime: new Date("1970-01-01T12:30:00.000Z"),
    },
    {
      subjectCode: "BCA401",
      teacherId: teacher1.id,
      programId: bcaProgram.id,
      semester: 4,
      dayOfWeek: "TUESDAY" as const,
      startTime: new Date("1970-01-01T13:00:00.000Z"),
      endTime: new Date("1970-01-01T14:30:00.000Z"),
    },

    // Dr. Priya Thapa teaches OS (BCT501) and Web Technologies (BCA202)
    {
      subjectCode: "BCT501",
      teacherId: teacher2.id,
      programId: bctProgram.id,
      semester: 5,
      dayOfWeek: "TUESDAY" as const,
      startTime: new Date("1970-01-01T10:00:00.000Z"),
      endTime: new Date("1970-01-01T11:30:00.000Z"),
    },
    {
      subjectCode: "BCA202",
      teacherId: teacher2.id,
      programId: bcaProgram.id,
      semester: 2,
      dayOfWeek: "THURSDAY" as const,
      startTime: new Date("1970-01-01T14:00:00.000Z"),
      endTime: new Date("1970-01-01T15:30:00.000Z"),
    },

    // Mr. Anil Karki teaches DSA (BCT301) and C Prog (BCT101)
    {
      subjectCode: "BCT301",
      teacherId: teacher3.id,
      programId: bctProgram.id,
      semester: 3,
      dayOfWeek: "MONDAY" as const,
      startTime: new Date("1970-01-01T11:00:00.000Z"),
      endTime: new Date("1970-01-01T12:30:00.000Z"),
    },
    {
      subjectCode: "BCT101",
      teacherId: teacher3.id,
      programId: bctProgram.id,
      semester: 1,
      dayOfWeek: "FRIDAY" as const,
      startTime: new Date("1970-01-01T08:30:00.000Z"),
      endTime: new Date("1970-01-01T10:00:00.000Z"),
    },
  ];

  const createdClasses = [];
  for (const c of classDefs) {
    const sub = createdSubjects.get(c.subjectCode);
    if (!sub) continue;
    const cls = await prisma.class.upsert({
      where: {
        subjectId_teacherId_programId_semester_dayOfWeek_startTime_endTime: {
          subjectId: sub.id,
          teacherId: c.teacherId,
          programId: c.programId,
          semester: c.semester,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          endTime: c.endTime,
        },
      },
      update: {},
      create: {
        subjectId: sub.id,
        teacherId: c.teacherId,
        programId: c.programId,
        semester: c.semester,
        dayOfWeek: c.dayOfWeek,
        startTime: c.startTime,
        endTime: c.endTime,
      },
    });
    createdClasses.push(cls);
  }
  console.log(`✅ ${createdClasses.length} Classes scheduled`);

  // 7. Attendance Sessions & Records
  if (createdClasses.length > 0) {
    const session1 = await prisma.attendanceSession.upsert({
      where: {
        classId_sessionDate: {
          classId: createdClasses[0].id,
          sessionDate: new Date("2026-08-20T00:00:00.000Z"),
        },
      },
      update: {},
      create: {
        classId: createdClasses[0].id,
        sessionDate: new Date("2026-08-20T00:00:00.000Z"),
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session1.id,
          studentId: students[0].id, // Aayush
        },
      },
      update: {},
      create: {
        sessionId: session1.id,
        studentId: students[0].id,
        status: "PRESENT",
      },
    });

    await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session1.id,
          studentId: students[1].id, // Sneha
        },
      },
      update: {},
      create: {
        sessionId: session1.id,
        studentId: students[1].id,
        status: "PRESENT",
      },
    });
    console.log("✅ Attendance session & records created");
  }

  // 8. Assessments & Results
  const subBct601 = createdSubjects.get("BCT601");
  if (subBct601) {
    const assessment1 = await prisma.assessment.upsert({
      where: {
        subjectId_semester_name: {
          subjectId: subBct601.id,
          semester: 6,
          name: "Mid-Term Examination",
        },
      },
      update: {},
      create: {
        subjectId: subBct601.id,
        programId: bctProgram.id,
        semester: 6,
        name: "Mid-Term Examination",
        maxMarks: 50,
        assessmentDate: new Date("2026-08-18"),
      },
    });

    await prisma.result.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId: assessment1.id,
          studentId: students[0].id,
        },
      },
      update: {},
      create: {
        assessmentId: assessment1.id,
        studentId: students[0].id,
        marks: 44.5,
        grade: "A",
      },
    });

    await prisma.result.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId: assessment1.id,
          studentId: students[1].id,
        },
      },
      update: {},
      create: {
        assessmentId: assessment1.id,
        studentId: students[1].id,
        marks: 48.0,
        grade: "A+",
      },
    });
  }

  const subBca401 = createdSubjects.get("BCA401");
  if (subBca401) {
    const assessment2 = await prisma.assessment.upsert({
      where: {
        subjectId_semester_name: {
          subjectId: subBca401.id,
          semester: 4,
          name: "Practical Assessment 1",
        },
      },
      update: {},
      create: {
        subjectId: subBca401.id,
        programId: bcaProgram.id,
        semester: 4,
        name: "Practical Assessment 1",
        maxMarks: 25,
        assessmentDate: new Date("2026-08-22"),
      },
    });

    await prisma.result.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId: assessment2.id,
          studentId: students[5].id, // Sita
        },
      },
      update: {},
      create: {
        assessmentId: assessment2.id,
        studentId: students[5].id,
        marks: 23,
        grade: "A",
      },
    });
  }
  console.log("✅ Assessments & Results recorded");

  // 9. Announcements
  const announcements = [
    {
      title: "Far Western University Academic Year 2026 Session Commences",
      body: "All students and faculty members are informed that regular academic coursework and laboratory sessions for the Fall 2026 semester have officially commenced. Attendance will be recorded digitally on the College ERP portal.",
    },
    {
      title: "Library and Digital Resource Access Pass Distribution",
      body: "Students can collect their RFID library credentials and institutional access cards from the administrative front desk starting this Friday between 10:00 AM and 4:00 PM.",
    },
    {
      title: "Call for Papers: National Engineering & IT Symposium 2026",
      body: "The Department of Computer & Electronics Engineering invites research papers and capstone project submissions for the upcoming National Engineering Symposium. Cash prizes and publication certificates will be awarded.",
    },
    {
      title: "Semester Examination Schedule & Form Submission Deadline",
      body: "Examination registration forms for the upcoming semester finals must be submitted to the examination department by the end of next week along with cleared dues.",
    },
  ];

  for (const a of announcements) {
    const existing = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (!existing) {
      await prisma.announcement.create({
        data: {
          title: a.title,
          body: a.body,
          authorId: adminUser.id,
          publishedAt: new Date(),
        },
      });
    }
  }
  console.log(`✅ Announcements created`);

  console.log("\n🎉 Seeding finished successfully!\n");
  console.log("-----------------------------------------");
  console.log("Demo Credentials:");
  console.log("• Admin:   admin@fwu.edu.np   / admin1234");
  console.log("• Teacher: teacher@fwu.edu.np / teacher1234");
  console.log("• Teacher: priya@fwu.edu.np   / teacher1234");
  console.log("• Teacher: anil@fwu.edu.np    / teacher1234");
  console.log("• Student: student@fwu.edu.np / student1234 (BCT Sem 6)");
  console.log("• Student: sita@fwu.edu.np    / student1234 (BCA Sem 4)");
  console.log("• Student: ram@fwu.edu.np     / student1234 (BCT Sem 3)");
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
