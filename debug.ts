import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://admin:admin@localhost:5432/college_erp";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({ select: { email: true, firstName: true, lastName: true, role: true } });
  const programs = await prisma.program.findMany({ select: { name: true, code: true, durationYears: true, departmentName: true } });
  const teachers = await prisma.teacher.findMany({ select: { employeeNo: true, user: { select: { firstName: true, lastName: true, email: true } } } });
  const students = await prisma.student.findMany({ select: { enrollmentNumber: true, user: { select: { firstName: true, lastName: true, email: true } }, program: { select: { code: true } }, currentSemester: true } });
  const subjects = await prisma.subject.findMany({ select: { code: true, name: true, program: { select: { code: true } }, semester: true } });
  const classes = await prisma.class.findMany({ select: { dayOfWeek: true, startTime: true, endTime: true, type: true, group: true, subject: { select: { code: true } }, program: { select: { code: true } }, semester: true, teacher: { select: { employeeNo: true } } } });
  const assessments = await prisma.assessment.findMany({ select: { program: { select: { code: true } }, semester: true, name: true, maxMarks: true, subject: { select: { code: true } }, assessmentDate: true } });
  const results = await prisma.result.findMany({ select: { marks: true, grade: true, assessment: { select: { subject: { select: { code: true } } } } } });
  const announcements = await prisma.announcement.findMany({ select: { title: true, body: true, publishedAt: true } });
  console.log(JSON.stringify({ users, teachers, students, programs, subjects, classes, assessments, results, announcements }, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });