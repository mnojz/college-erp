import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * Subjects are derived from the published curriculum
 * (see app/lib/curriculum-sync.ts) and are therefore read-only here.
 */
export async function GET() {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ program: { name: "asc" } }, { semester: "asc" }, { code: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      programId: true,
      semester: true,
      program: { select: { name: true, code: true } },
      // Teachers assigned to this subject (drives automatic class scheduling).
      subjectTeachers: {
        select: {
          teacherId: true,
          teacher: {
            select: {
              id: true,
              employeeNo: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({ subjects });
}
