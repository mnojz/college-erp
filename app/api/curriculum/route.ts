import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { syncSubjectsFromCurriculum } from "@/app/lib/curriculum-sync";

type CourseInput = { code: string | null; name: string; credits: number };
type SemesterInput = { label: string; courses: CourseInput[] };
type YearInput = { label: string; semesters: SemesterInput[] };
type ElectiveInput = { group: string; code: string | null; name: string; credits: number };
type CurriculumBody = {
  programId?: unknown;
  years?: unknown;
  electives?: unknown;
};

// GET /api/curriculum?programId=<id>  (public)
// Omit programId to receive every published curriculum (admin tooling).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("programId");

  if (!programId) {
    const curricula = await prisma.curriculum.findMany({
      include: {
        program: { select: { code: true, name: true, departmentName: true } },
        years: {
          orderBy: { yearNo: "asc" },
          include: {
            semesters: {
              orderBy: { semesterNo: "asc" },
              include: {
                courses: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        electives: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      },
    });
    return NextResponse.json({ curricula });
  }

  const curriculum = await prisma.curriculum.findUnique({
    where: { programId },
    include: {
      program: { select: { code: true, name: true, departmentName: true } },
      years: {
        orderBy: { yearNo: "asc" },
        include: {
          semesters: {
            orderBy: { semesterNo: "asc" },
            include: {
              courses: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
      electives: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
    },
  });

  if (!curriculum) return NextResponse.json({ curriculum: null });
  return NextResponse.json({ curriculum });
}

// PUT /api/curriculum  (admin, replaces the full structure for a program)
export async function PUT(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CurriculumBody;
  try {
    body = (await request.json()) as CurriculumBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const programId = typeof body.programId === "string" ? body.programId : "";
  if (!programId) {
    return NextResponse.json({ error: "programId is required" }, { status: 400 });
  }

  const program = await prisma.program.findUnique({ where: { id: programId }, select: { id: true } });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  if (!Array.isArray(body.years)) {
    return NextResponse.json({ error: "years must be an array" }, { status: 400 });
  }

  const years: YearInput[] = [];

  for (const rawYear of body.years as YearInput[]) {
    const label = typeof rawYear.label === "string" ? rawYear.label.trim() : "";
    const semesters = rawYear.semesters ?? [];
    if (!label) continue;
    if (!Array.isArray(semesters)) {
      return NextResponse.json({ error: `Semesters for "${label}" must be an array` }, { status: 400 });
    }

    const parsedSemesters: SemesterInput[] = [];
    for (const rawSem of semesters as SemesterInput[]) {
      const semLabel = typeof rawSem.label === "string" ? rawSem.label.trim() : "";
      const courses = rawSem.courses ?? [];
      if (!semLabel) continue;
      if (!Array.isArray(courses)) {
        return NextResponse.json({ error: `Courses for "${semLabel}" must be an array` }, { status: 400 });
      }

      const parsedCourses: CourseInput[] = courses
        .map((raw) => {
          const name = typeof raw.name === "string" ? raw.name.trim() : "";
          if (!name) return null;
          return {
            code: raw.code == null ? null : String(raw.code),
            name,
            credits: typeof raw.credits === "number" ? raw.credits : 3,
          };
        })
        .filter((c): c is CourseInput => c !== null);

      parsedSemesters.push({ label: semLabel, courses: parsedCourses });
    }

    years.push({ label, semesters: parsedSemesters });
  }

  const electives: ElectiveInput[] = Array.isArray(body.electives)
    ? (body.electives as ElectiveInput[])
        .map((raw) => {
          const name = typeof raw.name === "string" ? raw.name.trim() : "";
          const group = typeof raw.group === "string" ? raw.group.trim() : "";
          if (!name || !group) return null;
          return {
            group,
            code: raw.code == null ? null : String(raw.code),
            name,
            credits: typeof raw.credits === "number" ? raw.credits : 3,
          };
        })
        .filter((e): e is ElectiveInput => e !== null)
    : [];

  try {
    const curriculum = await prisma.$transaction(async (tx) => {
      await tx.curriculum.deleteMany({ where: { programId } });

      return tx.curriculum.create({
        data: {
          programId,
          years: {
            create: years.map((y, yi) => ({
              yearNo: yi + 1,
              label: y.label,
              semesters: {
                create: y.semesters.map((s, si) => ({
                  semesterNo: si + 1,
                  label: s.label,
                  courses: {
                    create: s.courses.map((c, ci) => ({
                      code: c.code,
                      name: c.name,
                      credits: c.credits,
                      sortOrder: ci,
                    })),
                  },
                })),
              },
            })),
          },
          electives: {
            create: electives.map((e, ei) => ({
              group: e.group,
              code: e.code,
              name: e.name,
              credits: e.credits,
              sortOrder: ei,
            })),
          },
        },
      });
    });

    return NextResponse.json({ curriculum: { id: curriculum.id } }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/curriculum error:", error);
    return NextResponse.json({ error: "Unable to save curriculum" }, { status: 500 });
  } finally {
    // Keep the operational Subject table in sync with the published
    // curriculum (best-effort — never blocks the save response).
    try {
      await syncSubjectsFromCurriculum(prisma, programId);
    } catch (syncError) {
      console.error("Subject sync after curriculum save failed:", syncError);
    }
  }
}