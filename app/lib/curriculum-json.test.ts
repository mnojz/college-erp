import { describe, it, expect } from "vitest";

// Re-usable parser test matching the logic in app/admin/curriculum/page.tsx
function parseCurriculumJson(jsonContent: string) {
  let parsed = JSON.parse(jsonContent);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (parsed.curriculum) parsed = parsed.curriculum;
    else if (parsed.data) parsed = parsed.data;
  }

  const rawCourseList = Array.isArray(parsed?.courses)
    ? parsed.courses
    : Array.isArray(parsed) &&
      parsed.length > 0 &&
      (parsed[0].semester !== undefined || parsed[0].semesterNo !== undefined)
    ? parsed
    : null;

  if (rawCourseList) {
    const yearMap = new Map<number, Map<number, Array<{ code: string; name: string; credits: number; hasTheory: boolean; hasPractical: boolean }>>>();

    for (const item of rawCourseList) {
      const semNo = Number(item.semester ?? item.semesterNo ?? 1) || 1;
      const yearNo = Number(item.year) > 0 ? Number(item.year) : Math.ceil(semNo / 2) || 1;

      if (!yearMap.has(yearNo)) yearMap.set(yearNo, new Map());
      const semMap = yearMap.get(yearNo)!;
      if (!semMap.has(semNo)) semMap.set(semNo, []);

      const code = String(item.code || item.courseCode || "").trim().toUpperCase();
      const name = String(item.name || item.title || item.courseName || "").trim();
      if (!name) continue;

      const credits = Number.isFinite(Number(item.credits ?? item.credit))
        ? Number(item.credits ?? item.credit)
        : 3;

      const valTh = item.hasTheory ?? item.th ?? item.theory;
      const valPr = item.hasPractical ?? item.pr ?? item.practical;

      let hasTheory = valTh !== undefined ? Boolean(valTh) : true;
      let hasPractical = valPr !== undefined ? Boolean(valPr) : false;

      const typeStr = String(item.type || "").toLowerCase();
      if (typeStr === "practical" || typeStr === "lab") {
        if (valTh === undefined) hasTheory = false;
        hasPractical = true;
      } else if (typeStr === "theory" && valPr === undefined) {
        hasPractical = false;
      }

      if (!hasTheory && !hasPractical) hasTheory = true;

      semMap.get(semNo)!.push({ code, name, credits, hasTheory, hasPractical });
    }

    const generatedYears = [];
    const sortedYearKeys = Array.from(yearMap.keys()).sort((a, b) => a - b);
    for (const yNo of sortedYearKeys) {
      const semMap = yearMap.get(yNo)!;
      const sortedSemKeys = Array.from(semMap.keys()).sort((a, b) => a - b);
      const sems = sortedSemKeys.map((sNo) => ({
        label: `Semester ${sNo}`,
        courses: semMap.get(sNo)!,
      }));
      generatedYears.push({
        label: `Year ${yNo}`,
        semesters: sems,
      });
    }

    const parsedElectives = [];
    const rawElectiveGroups = Array.isArray(parsed?.elective_groups)
      ? parsed.elective_groups
      : Array.isArray(parsed?.electives)
      ? parsed.electives
      : [];

    for (const grp of rawElectiveGroups) {
      if (Array.isArray(grp.options)) {
        const rawGroup = String(grp.name || grp.group || (grp.group_id ? `ELECTIVE_${grp.group_id}` : "ELECTIVE_I")).trim().toUpperCase();
        const group = rawGroup.includes("II") || rawGroup.includes("2") ? "ELECTIVE_II" : "ELECTIVE_I";

        for (const opt of grp.options) {
          const name = String(opt.name || opt.title || "").trim();
          if (!name) continue;
          const code = String(opt.code || "").trim().toUpperCase();
          const credits = Number.isFinite(Number(opt.credits ?? opt.credit)) ? Number(opt.credits ?? opt.credit) : 3;
          parsedElectives.push({ group, code, name, credits });
        }
      }
    }

    return {
      years: generatedYears,
      electives: parsedElectives,
    };
  }

  throw new Error("Invalid format");
}

describe("Curriculum Flexible JSON Parser", () => {
  it("parses the new flexible course & elective_groups format accurately", () => {
    const json = JSON.stringify({
      program: "Architecture",
      courses: [
        {
          code: "AR111",
          name: "Basic Design I",
          credits: 4,
          year: 1,
          semester: 1,
          type: "core",
          hasTheory: true,
          hasPractical: true,
        },
        {
          code: "SH112",
          name: "Engineering Mathematics I",
          credits: 3,
          year: 1,
          semester: 1,
          type: "core",
        },
        {
          code: "AR591",
          name: "Thesis / Practicum",
          credits: 6,
          year: 5,
          semester: 10,
          type: "practical",
        },
      ],
      elective_groups: [
        {
          group_id: 1,
          name: "Elective I",
          target_semester: 7,
          required_credits: 3,
          options: [
            {
              code: "AR4701",
              name: "Light Weight Construction Materials",
              credits: 3,
            },
          ],
        },
      ],
    });

    const result = parseCurriculumJson(json);
    expect(result.years.length).toBe(2); // Year 1 and Year 5
    expect(result.years[0].label).toBe("Year 1");
    expect(result.years[0].semesters[0].courses.length).toBe(2);
    expect(result.years[1].label).toBe("Year 5");
    expect(result.years[1].semesters[0].label).toBe("Semester 10");
    expect(result.years[1].semesters[0].courses[0].hasPractical).toBe(true);
    expect(result.years[1].semesters[0].courses[0].hasTheory).toBe(false);

    expect(result.electives.length).toBe(1);
    expect(result.electives[0].code).toBe("AR4701");
    expect(result.electives[0].group).toBe("ELECTIVE_I");
  });

  it("automatically infers academic year when year is omitted from courses", () => {
    const json = JSON.stringify({
      courses: [
        { code: "SUB1", name: "Subject 1", credits: 3, semester: 1 },
        { code: "SUB9", name: "Architecture Studio IX", credits: 5, semester: 9 },
        { code: "SUB10", name: "Architecture Thesis", credits: 6, semester: 10 },
      ],
    });

    const result = parseCurriculumJson(json);
    expect(result.years.length).toBe(2);
    expect(result.years[0].label).toBe("Year 1"); // sem 1 -> year 1
    expect(result.years[1].label).toBe("Year 5"); // sem 9 & 10 -> Math.ceil(9/2)=5 -> year 5
    expect(result.years[1].semesters.length).toBe(2);
    expect(result.years[1].semesters[0].label).toBe("Semester 9");
    expect(result.years[1].semesters[1].label).toBe("Semester 10");
  });
});

