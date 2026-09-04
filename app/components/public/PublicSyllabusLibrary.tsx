"use client";

import { useEffect, useMemo, useState } from "react";
import { SyllabusToolbar } from "@/app/components/syllabi/SyllabusToolbar";
import {
  useSyllabusGroups,
  type GroupedByDepartment,
} from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusPublicGroupedView } from "@/app/components/syllabi/SyllabusPublicGroupedView";
import { type ProgramsMeta, type SyllabusDto } from "@/app/lib/syllabi-shared";

type Syllabus = SyllabusDto;

/**
 * Anonymous public syllabus library — no auth required.
 * Renders the grouped department → program → semester(1..8) list with
 * search + department/program/semester filters, mirroring /student/syllabus.
 */
export function PublicSyllabusLibrary() {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({
    departments: [],
    programs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [listRes, metaRes] = await Promise.all([
          fetch("/api/syllabus"),
          fetch("/api/syllabus/meta"),
        ]);
        if (!listRes.ok) throw new Error("Unable to load syllabus");
        const listData = await listRes.json();
        setSyllabi(listData.syllabi ?? []);
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setMeta({
            departments: metaData.departments ?? [],
            programs: metaData.programs ?? [],
          });
        }
      } catch (err) {
        setError((err as Error).message ?? "Unable to load syllabus");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return syllabi.filter((s) => {
      if (filterProgram && s.programId !== filterProgram) return false;
      if (filterSemester && s.semester !== Number.parseInt(filterSemester, 10))
        return false;
      if (term) {
        const haystack =
          `${s.title ?? ""} ${s.fileName} ${s.departmentName} ${s.programCode ?? ""} ${s.programName ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [syllabi, q, filterProgram, filterSemester]);

  const groups: GroupedByDepartment[] = useSyllabusGroups(filtered, meta.programs);

  function resetFilters() {
    setQ("");
    setFilterProgram("");
    setFilterSemester("");
  }

  if (loading) {
    return <p style={{ color: "var(--ink-soft)", padding: "24px 0" }}>Loading…</p>;
  }

  return (
    <div>
      {error && <p className="notes-form-error">{error}</p>}

      <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700 }}>
        Syllabus Library
      </h2>

      <SyllabusToolbar
        q={q}
        filterProgram={filterProgram}
        filterSemester={filterSemester}
        programs={meta.programs}
        onChange={(p) => {
          if (p.q !== undefined) setQ(p.q);
          if (p.filterProgram !== undefined) setFilterProgram(p.filterProgram);
          if (p.filterSemester !== undefined) setFilterSemester(p.filterSemester);
        }}
        onReset={resetFilters}
      />

      <SyllabusPublicGroupedView groups={groups} />

      {filtered.length === 0 && !error && (
        <div className="profile-info-card notes-empty">
          <h3>No syllabus found</h3>
          <p>
            {syllabi.length === 0
              ? "No syllabus files are currently available."
              : "No syllabus files match the selected filters. Try adjusting your search or filters."}
          </p>
        </div>
      )}
    </div>
  );
}