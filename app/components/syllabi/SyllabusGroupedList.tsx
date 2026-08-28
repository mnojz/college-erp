"use client";

import { useMemo } from "react";
import { type SyllabusDto } from "@/app/lib/syllabi-shared";

type Syllabus = SyllabusDto;
type Program = { id: string; name: string; code: string; departmentName: string };

export interface GroupedByDepartment {
  department: string;
  programs: Array<{
    program: { label: string; id: string | null } | null;
    bySemester: Map<number, Syllabus[]>;
  }>;
}

/**
 * Groups a flat syllabus list into department → program → semester(1..8)
 * so each semester slot can render 1-8 lists. Programs with no syllabi
 * are omitted; every program that has at least one syllabus shows all 8
 * semester slots (empty ones render a placeholder).
 */
export function useSyllabusGroups(
  syllabi: Syllabus[],
  programs: Program[],
): GroupedByDepartment[] {
  return useMemo(() => {
    const byDept = new Map<string, Syllabus[]>();
    for (const s of syllabi) {
      const arr = byDept.get(s.departmentName) ?? [];
      arr.push(s);
      byDept.set(s.departmentName, arr);
    }

    const result: GroupedByDepartment[] = [];
    for (const [department, items] of byDept) {
      const byProgram = new Map<string | null, Syllabus[]>();
      for (const s of items) {
        const key = s.programId ?? "__none__";
        const arr = byProgram.get(key) ?? [];
        arr.push(s);
        byProgram.set(key, arr);
      }

      const programGroups: GroupedByDepartment["programs"] = [];

      // Programs (with a program link) first, then department-wide syllabi.
      const programIds = [
        ...new Set(items.filter((s) => s.programId).map((s) => s.programId as string)),
      ];
      for (const pid of programIds) {
        const progItems = byProgram.get(pid) ?? [];
        const bySemester = indexBySemester(progItems);
        const prog = programs.find((p) => p.id === pid);
        programGroups.push({
          program: prog
            ? { label: `${prog.code} — ${prog.name}`, id: pid }
            : { label: pid, id: pid },
          bySemester,
        });
      }

      const noneItems = byProgram.get("__none__");
      if (noneItems && noneItems.length > 0) {
        programGroups.push({ program: null, bySemester: indexBySemester(noneItems) });
      }

      result.push({ department, programs: programGroups });
    }

    return result.sort((a, b) => a.department.localeCompare(b.department));
  }, [syllabi, programs]);
}

function indexBySemester(items: Syllabus[]): Map<number, Syllabus[]> {
  const bySemester = new Map<number, Syllabus[]>();
  for (const s of items) {
    const arr = bySemester.get(s.semester) ?? [];
    arr.push(s);
    bySemester.set(s.semester, arr);
  }
  // Deterministic, readable order inside every semester slot.
  for (const arr of bySemester.values()) {
    arr.sort((a, b) =>
      (a.title ?? a.fileName).localeCompare(b.title ?? b.fileName) ||
      a.fileName.localeCompare(b.fileName),
    );
  }
  return bySemester;
}
