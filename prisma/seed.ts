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
  console.log("🌱 Starting database seeding...");

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
  console.log("✅ Admin user created:", adminUser.email);

  // 2. Create Program
  const program = await prisma.program.upsert({
    where: { code: "BCT" },
    update: {},
    create: {
      name: "Bachelor in Computer Engineering",
      code: "BCT",
      durationYears: 4,
      departmentName: "Department of Computer & Electronics Engineering",
    },
  });
  console.log("✅ Program created:", program.name, "(", program.durationYears * 2, "semesters)");

  // No Semester table — semesters are derived integers 1..durationYears*2

  // 3. Create Teacher
  const teacherPasswordHash = await hash("teacher1234", 12);
  const teacherUser = await prisma.user.upsert({
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

  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      employeeNo: "FWU-EMP-101",
    },
  });
  console.log("✅ Teacher created:", teacherUser.firstName, teacherUser.lastName);

  // 4. Create Students
  const studentPasswordHash = await hash("student1234", 12);
  const studentUser1 = await prisma.user.upsert({
    where: { email: "student@fwu.edu.np" },
    update: {},
    create: {
      email: "student@fwu.edu.np",
      passwordHash: studentPasswordHash,
      firstName: "Aayush",
      lastName: "Adhikari",
      role: "STUDENT",
    },
  });

  const student1 = await prisma.student.upsert({
    where: { userId: studentUser1.id },
    update: {
      programId: program.id,
      currentSemester: 6,
    },
    create: {
      userId: studentUser1.id,
      enrollmentNumber: "2024-BCT-01",
      registrationId: "REG-2024-001",
      rollNumber: "01",
      admissionDate: new Date("2024-08-15"),
      programId: program.id,
      currentSemester: 6,
      programEnrollmentStatus: "ENROLLED",
    },
  });

  const studentUser2 = await prisma.user.upsert({
    where: { email: "sneha@fwu.edu.np" },
    update: {},
    create: {
      email: "sneha@fwu.edu.np",
      passwordHash: studentPasswordHash,
      firstName: "Sneha",
      lastName: "Bhandari",
      role: "STUDENT",
    },
  });

  await prisma.student.upsert({
    where: { userId: studentUser2.id },
    update: {
      programId: program.id,
      currentSemester: 6,
    },
    create: {
      userId: studentUser2.id,
      enrollmentNumber: "2024-BCT-02",
      registrationId: "REG-2024-002",
      rollNumber: "02",
      admissionDate: new Date("2024-08-15"),
      programId: program.id,
      currentSemester: 6,
      programEnrollmentStatus: "ENROLLED",
    },
  });

  console.log("✅ Students created & assigned to Semester 6");

  // 5. Create Subjects (semester is an integer 1-8)
  await prisma.subject.upsert({
    where: { code: "BCT101" },
    update: {},
    create: {
      name: "Structured Programming in C",
      code: "BCT101",
      programId: program.id,
      semester: 1,
    },
  });

  await prisma.subject.upsert({
    where: { code: "BCT102" },
    update: {},
    create: {
      name: "Digital Logic & Circuit Design",
      code: "BCT102",
      programId: program.id,
      semester: 1,
    },
  });

  const subject601 = await prisma.subject.upsert({
    where: { code: "BCT601" },
    update: {},
    create: {
      name: "Database Management Systems",
      code: "BCT601",
      programId: program.id,
      semester: 6,
    },
  });
  console.log("✅ Subjects created");

  // 6. Create Classes (semester is an integer)
  const class1 = await prisma.class.upsert({
    where: {
      subjectId_teacherId_programId_semester_dayOfWeek_startTime_endTime: {
        subjectId: subject601.id,
        teacherId: teacher.id,
        programId: program.id,
        semester: 6,
        dayOfWeek: "MONDAY",
        startTime: new Date("1970-01-01T09:00:00.000Z"),
        endTime: new Date("1970-01-01T10:30:00.000Z"),
      },
    },
    update: {},
    create: {
      subjectId: subject601.id,
      teacherId: teacher.id,
      programId: program.id,
      semester: 6,
      dayOfWeek: "MONDAY",
      startTime: new Date("1970-01-01T09:00:00.000Z"),
      endTime: new Date("1970-01-01T10:30:00.000Z"),
    },
  });

  await prisma.class.upsert({
    where: {
      subjectId_teacherId_programId_semester_dayOfWeek_startTime_endTime: {
        subjectId: subject601.id,
        teacherId: teacher.id,
        programId: program.id,
        semester: 6,
        dayOfWeek: "WEDNESDAY",
        startTime: new Date("1970-01-01T11:00:00.000Z"),
        endTime: new Date("1970-01-01T12:30:00.000Z"),
      },
    },
    update: {},
    create: {
      subjectId: subject601.id,
      teacherId: teacher.id,
      programId: program.id,
      semester: 6,
      dayOfWeek: "WEDNESDAY",
      startTime: new Date("1970-01-01T11:00:00.000Z"),
      endTime: new Date("1970-01-01T12:30:00.000Z"),
    },
  });
  console.log("✅ Classes scheduled");

  // 7. Sample Attendance Session
  const session1 = await prisma.attendanceSession.upsert({
    where: {
      classId_sessionDate: {
        classId: class1.id,
        sessionDate: new Date("2026-08-20T00:00:00.000Z"),
      },
    },
    update: {},
    create: {
      classId: class1.id,
      sessionDate: new Date("2026-08-20T00:00:00.000Z"),
    },
  });

  await prisma.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session1.id,
        studentId: student1.id,
      },
    },
    update: {},
    create: {
      sessionId: session1.id,
      studentId: student1.id,
      status: "PRESENT",
    },
  });
  console.log("✅ Attendance session & record created");

  // 8. Sample Assessment and Result
  const assessment1 = await prisma.assessment.upsert({
    where: {
      subjectId_semester_name: {
        subjectId: subject601.id,
        semester: 6,
        name: "Mid-Term Examination",
      },
    },
    update: {},
    create: {
      subjectId: subject601.id,
      programId: program.id,
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
        studentId: student1.id,
      },
    },
    update: {},
    create: {
      assessmentId: assessment1.id,
      studentId: student1.id,
      marks: 44.5,
      grade: "A",
    },
  });
  console.log("✅ Assessment & results recorded");

  // 9. Sample Announcements
  await prisma.announcement.create({
    data: {
      title: "Far Western University Academic Year 2026 Session Commences",
      body: "All students and faculty members are informed that the regular academic coursework and laboratory sessions for the Fall 2026 semester have officially commenced. Attendance will be recorded digitally on the College ERP portal.",
      authorId: adminUser.id,
      publishedAt: new Date(),
    },
  });

  await prisma.announcement.create({
    data: {
      title: "Library and Digital Resource Access Pass Distribution",
      body: "Freshmen students can collect their RFID library credentials and institutional access cards from the administrative front desk starting this Friday.",
      authorId: adminUser.id,
      publishedAt: new Date(),
    },
  });

  console.log("✅ Announcements published");
  console.log("\n🎉 Seeding finished successfully!\n");
  console.log("-----------------------------------------");
  console.log("Demo Credentials:");
  console.log("• Admin:   admin@fwu.edu.np   / admin1234");
  console.log("• Teacher: teacher@fwu.edu.np / teacher1234");
  console.log("• Student: student@fwu.edu.np / student1234");
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
