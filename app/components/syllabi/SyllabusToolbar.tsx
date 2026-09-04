"use client";

import { SEMESTERS } from "@/app/lib/syllabi-shared";
import { IconFilterOff, IconSearch } from "@tabler/icons-react";

interface Props {
  q: string;
  filterProgram: string;
  filterSemester: string;
  programs: Array<{ id: string; code: string; name: string }>;
  onChange: (patch: Partial<Props>) => void;
  onReset: () => void;
}

/** Search bar + program/semester filter dropdowns (single-department mode). */
export function SyllabusToolbar({
  q,
  filterProgram,
  filterSemester,
  programs,
  onChange,
  onReset,
}: Props) {
  const hasFilters = !!(q || filterProgram || filterSemester);
  return (
    <div className="syllabus-toolbar">
      <div className="syllabus-toolbar-search">
        <IconSearch size={15} aria-hidden="true" />
        <input
          type="text"
          placeholder="Search title, program…"
          value={q}
          onChange={(e) => onChange({ q: e.target.value })}
          aria-label="Search syllabus"
        />
      </div>
      <select
        className="syllabus-toolbar-select"
        value={filterProgram}
        onChange={(e) => onChange({ filterProgram: e.target.value })}
        disabled={programs.length === 0}
        aria-label="Filter by program"
      >
        <option value="">All Programs</option>
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      <select
        className="syllabus-toolbar-select"
        value={filterSemester}
        onChange={(e) => onChange({ filterSemester: e.target.value })}
        aria-label="Filter by semester"
      >
        <option value="">All Semesters</option>
        {SEMESTERS.map((s) => (
          <option key={s} value={String(s)}>
            Semester {s}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button type="button" className="syllabus-toolbar-reset" onClick={onReset}>
          <IconFilterOff size={14} aria-hidden="true" />
          Clear Filters
        </button>
      )}
    </div>
  );
}
