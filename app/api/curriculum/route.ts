import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { syncSubjectsFromCurriculum } from "@/app/lib/curriculum-sync";

type CourseInput = {
  code: string | null;
  name: string;
  credits: number;
  hasTheory: boolean;
  hasPractical: boolean;
};
type SemesterInput = { label: string; courses: CourseInput[] };
type YearInput = { label: string; semesters: SemesterInput[] };
type ElectiveInput = { group: string; code: string | null; name: string; credits: number };
type CurriculumBody = {
  programId?: unknown;
  courses?: unknown;
  elective_groups?: unknown;
};

// Helper: transform a curriculum object with years & electives to include courses & elective_groups
function enrichCurriculum<T extends {
  years: Array<{
    yearNo: number;
    label: string;
    semesters: Array<{
      semesterNo: number;
      label: string;
      courses: Array<{
        code: string | null;
        name: string;
        credits: number;
        hasTheory: boolean;
        hasPractical: boolean;
      }>;
    }>;
  }>;
  electives: Array<{
    group: string;
    code: string | null;
    name: string;
    credits: number;
  }>;
}>(curriculum: T) {
  let totalCredits = 0;
  let totalCourses = 0;
  let totalSemesters = 0;

  const courses = curriculum.years.flatMap((y) =>
    y.semesters.flatMap((s) => {
      totalSemesters += 1;
      return s.courses.map((c) => {
        totalCourses += 1;
        totalCredits += c.credits || 0;
        return {
          code: c.code,
          name: c.name,
          credits: c.credits,
          year: y.yearNo,
          semester: s.semesterNo,
          type: c.hasPractical && !c.hasTheory ? "practical" : "core",
          hasTheory: c.hasTheory,
          hasPractical: c.hasPractical,
        };
      });
    }),
  );

  const groupMap = new Map<string, typeof curriculum.electives>();
  for (const el of curriculum.electives) {
    const arr = groupMap.get(el.group) ?? [];
    arr.push(el);
    groupMap.set(el.group, arr);
  }

  let gIdx = 1;
  const elective_groups = Array.from(groupMap.entries()).map(([grp, options]) => ({
    group_id: gIdx++,
    name: grp,
    options: options.map((opt) => ({
      code: opt.code,
      name: opt.name,
      credits: opt.credits,
    })),
  }));

  return {
    ...curriculum,
    courses,
    elective_groups,
    summary: {
      totalYears: curriculum.years.length,
      totalSemesters,
      totalCourses,
      totalCredits,
      totalElectives: curriculum.electives.length,
    },
  };
}

// GET /api/curriculum?programId=<id>  (public)
// Omit programId to receive every published curriculum (admin tooling).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("programId");

  if (!programId) {
    const rawCurricula = await prisma.curriculum.findMany({
      include: {
        program: { select: { code: true, name: true, departmentName: true, durationYears: true } },
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
    const curricula = rawCurricula.map((c) => enrichCurriculum(c));
    return NextResponse.json({ curricula });
  }

  const curriculum = await prisma.curriculum.findUnique({
    where: { programId },
    include: {
      program: { select: { code: true, name: true, departmentName: true, durationYears: true } },
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
  return NextResponse.json({ curriculum: enrichCurriculum(curriculum) });
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

  const program = await prisma.program.findUnique({ where: { id: programId }, select: { id: true, durationYears: true } });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  let years: YearInput[] = [];
  let electives: ElectiveInput[] = [];
  let courseStructureError: string | null = null;

  // Support flexible format: { courses: [...], elective_groups: [...] }
  if (Array.isArray(body.courses) && body.courses.length > 0) {
    const yearMap = new Map<number, Map<number, CourseInput[]>>();

    for (const raw of body.courses as Array<{
      code?: string | null;
      name?: string;
      title?: string;
      credits?: number;
      credit?: number;
      year?: number;
      semester?: number;
      semesterNo?: number;
      type?: string;
      hasTheory?: boolean;
      hasPractical?: boolean;
      th?: boolean;
      pr?: boolean;
    }>) {
      const name = typeof raw.name === "string" ? raw.name.trim() : typeof raw.title === "string" ? raw.title.trim() : "";
      if (!name) continue;

      const semNo = Number(raw.semester ?? raw.semesterNo ?? 1) || 1;
      const yearNo = Number(raw.year) > 0 ? Number(raw.year) : Math.ceil(semNo / 2) || 1;

      if (!yearMap.has(yearNo)) yearMap.set(yearNo, new Map());
      const semMap = yearMap.get(yearNo)!;
      if (!semMap.has(semNo)) semMap.set(semNo, []);

      const valTh = raw.hasTheory ?? raw.th;
      const valPr = raw.hasPractical ?? raw.pr;
      let hasTheory = valTh !== undefined ? Boolean(valTh) : true;
      let hasPractical = valPr !== undefined ? Boolean(valPr) : false;

      if (raw.type === "practical" || raw.type === "lab") {
        if (valTh === undefined) hasTheory = false;
        hasPractical = true;
      }
      if (!hasTheory && !hasPractical) hasTheory = true;

      const credits = Number.isFinite(Number(raw.credits ?? raw.credit)) ? Number(raw.credits ?? raw.credit) : 3;
      const code = raw.code == null ? null : String(raw.code).trim().toUpperCase();

      semMap.get(semNo)!.push({
        code,
        name,
        credits,
        hasTheory,
        hasPractical,
      });
    }

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    for (const yNo of sortedYears) {
      const semMap = yearMap.get(yNo)!;
      const sortedSems = Array.from(semMap.keys()).sort((a, b) => a - b);
      const parsedSemesters: SemesterInput[] = sortedSems.map((sNo) => ({
        label: `Semester ${sNo}`,
        courses: semMap.get(sNo)!,
      }));
      years.push({
        label: `Year ${yNo}`,
        semesters: parsedSemesters,
      });
    }

    // Process elective_groups if provided
    if (Array.isArray(body.elective_groups)) {
      for (const grp of body.elective_groups as Array<{
        group_id?: number | string;
        name?: string;
        group?: string;
        options?: Array<{ code?: string | null; name?: string; title?: string; credits?: number }>;
      }>) {
        const groupLabel = grp.name?.trim() || grp.group?.trim() || (grp.group_id ? `Elective ${grp.group_id}` : "Elective");
        if (Array.isArray(grp.options)) {
          for (const opt of grp.options) {
            const name = opt.name?.trim() || opt.title?.trim() || "";
            if (!name) continue;
            electives.push({
              group: groupLabel,
              code: opt.code == null ? null : String(opt.code).trim().toUpperCase(),
              name,
              credits: typeof opt.credits === "number" ? opt.credits : 3,
            });
          }
        }
      }
    }
  } else {
    return NextResponse.json({ error: "The 'courses' array is required in the curriculum payload" }, { status: 400 });
  }

  if (courseStructureError) {
    return NextResponse.json({ error: courseStructureError }, { status: 400 });
  }



  // Calculate dynamic durationYears determined directly by the curriculum
  const totalYears = Math.max(1, years.length);

  try {
    const curriculum = await prisma.$transaction(async (tx) => {
      await tx.curriculum.deleteMany({ where: { programId } });

      // Dynamically update program durationYears to match the curriculum
      await tx.program.update({
        where: { id: programId },
        data: { durationYears: totalYears },
      });

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
                      hasTheory: c.hasTheory,
                      hasPractical: c.hasPractical,
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

    return NextResponse.json(
      {
        curriculum: {
          id: curriculum.id,
          durationYears: totalYears,
          totalSemesters: totalYears * 2,
        },
      },
      { status: 200 },
    );
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