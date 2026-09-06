"use client";

import { useMemo } from "react";
import { type SyllabusDto } from "@/app/lib/syllabi-shared";

type Syllabus = SyllabusDto;
type Program = { id: string; name: string; code: string; departmentName: string };

export interface ProgramGroup {
  /** Stable React key: program id, or "__unassigned__" for rows without a program. */
  key: string;
  program: { id: string | null; name: string; code: string; departmentName: string } | null;
  bySemester: Map<number, Syllabus[]>;
}

/**
 * Groups a flat syllabus list into PROGRAM sections (Computer, Civil,
 * Architecture, …). Each program owning at least one syllabus becomes its own
 * section showing all 8 semester slots (empty slots render a placeholder).
 * Program-less rows land in a final "Unassigned" section. Known programs are
 * sorted by department then name, so newly added programs automatically get
 * their own section without further changes.
 */
export function useSyllabusProgramGroups(
  syllabi: Syllabus[],
  programs: Program[],
): ProgramGroup[] {
  return useMemo(() => {
    const knownById = new Map(programs.map((p) => [p.id, p]));
    const byProgram = new Map<string, { program: ProgramGroup["program"]; items: Syllabus[] }>();

    for (const s of syllabi) {
      const pid = s.programId ?? "";
      let entry = byProgram.get(pid);
      if (!entry) {
        let program: ProgramGroup["program"] = null;
        if (pid) {
          const known = knownById.get(pid);
          program = known
            ? {
                id: known.id,
                name: known.name,
                code: known.code,
                departmentName: known.departmentName,
              }
            : {
                // Orphan row: syllabus references a program missing from meta,
                // so fall back to whatever the row itself carries.
                id: pid,
                name: s.programName ?? "Other program",
                code: s.programCode ?? "—",
                departmentName: s.departmentName ?? "Other",
              };
        }
        entry = { program, items: [] };
        byProgram.set(pid, entry);
      }
      entry.items.push(s);
    }

    // Known programs with syllabi, sorted by department then name.
    type Bucket = { program: ProgramGroup["program"]; items: Syllabus[] };
    const known: Array<{ pid: string; entry: Bucket }> = [];
    for (const [pid, entry] of byProgram) {
      if (pid && entry.program && knownById.has(pid)) known.push({ pid, entry });
    }
    known.sort((a, b) => {
      const x = a.entry.program!;
      const y = b.entry.program!;
      return (
        x.departmentName.localeCompare(y.departmentName) || x.name.localeCompare(y.name)
      );
    });

    const groups: ProgramGroup[] = known.map(({ pid, entry }) => ({
      key: pid,
      program: entry.program,
      bySemester: indexBySemester(entry.items),
    }));

    // Orphan groups: program id unknown to meta, plus program-less rows last.
    const orphans: Array<{ pid: string; entry: Bucket }> = [];
    for (const [pid, entry] of byProgram) {
      if (!pid || !knownById.has(pid)) orphans.push({ pid, entry });
    }
    orphans.sort((a, b) =>
      (a.entry.program?.name ?? "").localeCompare(b.entry.program?.name ?? ""),
    );
    for (const { pid, entry } of orphans) {
      groups.push({
        key: pid || "__unassigned__",
        program: entry.program,
        bySemester: indexBySemester(entry.items),
      });
    }

    return groups;
  }, [syllabi, programs]);
}

function indexBySemester(items: Syllabus[]): Map<number, Syllabus[]> {
  const bySemester = new Map<number, Syllabus[]>();
  for (const s of items) {
    // Defensive: rows without a valid semester can never land in a 1..8 slot.
    if (typeof s.semester !== "number") continue;
    const arr = bySemester.get(s.semester) ?? [];
    arr.push(s);
    bySemester.set(s.semester, arr);
  }
  // Deterministic, readable order inside every semester slot.
  for (const arr of bySemester.values()) {
    arr.sort(
      (a, b) =>
        (a.title ?? a.fileName ?? "").localeCompare(b.title ?? b.fileName ?? "") ||
        (a.fileName ?? "").localeCompare(b.fileName ?? ""),
    );
  }
  return bySemester;
}
