import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/materials/meta — filter options for the Notes library:
 * departments, programs, subjects and uploading teachers.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [programs, subjects, teachers] = await Promise.all([
      prisma.program.findMany({
        orderBy: [{ departmentName: "asc" }, { name: "asc" }],
        select: { id: true, name: true, code: true, departmentName: true, durationYears: true },
      }),
      prisma.subject.findMany({
        orderBy: [{ program: { name: "asc" } }, { semester: "asc" }, { code: "asc" }],
        select: { id: true, name: true, code: true, programId: true, semester: true },
      }),
      prisma.user.findMany({
        where: { uploadedMaterials: { some: {} } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    const departments = [...new Set(programs.map((p) => p.departmentName))].sort();

    return NextResponse.json({
      departments,
      programs,
      subjects,
      teachers: teachers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`.trim() })),
    });
  } catch (error) {
    console.error("GET /api/materials/meta error:", error);
    return NextResponse.json({ error: "Unable to load filter options" }, { status: 500 });
  }
}
