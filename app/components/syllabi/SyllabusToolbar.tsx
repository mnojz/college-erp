"use client";

import { SEMESTERS, type ProgramsMeta } from "@/app/lib/syllabi-shared";

interface Props {
  meta: ProgramsMeta;
  q: string;
  filterDept: string;
  filterProgram: string;
  filterSemester: string;
  departmentPrograms: Array<{ id: string; code: string; name: string }>;
  onChange: (patch: Partial<Props>) => void;
  onReset: () => void;
}

/** Search bar + department/program/semester filter dropdowns. */
export function SyllabusToolbar({
  meta,
  q,
  filterDept,
  filterProgram,
  filterSemester,
  departmentPrograms,
  onChange,
  onReset,
}: Props) {
  const hasFilters = !!(q || filterDept || filterProgram || filterSemester);
  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <input
        type="text"
        placeholder="Search title, program, department…"
        value={q}
        onChange={(e) => onChange({ q: e.target.value })}
        className="notes-topic-input"
        style={{ minWidth: "220px" }}
      />
      <select
        value={filterDept}
        onChange={(e) => onChange({ filterDept: e.target.value, filterProgram: "" })}
      >
        <option value="">All Departments</option>
        {(meta.departments ?? []).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={filterProgram}
        onChange={(e) => onChange({ filterProgram: e.target.value })}
        disabled={!filterDept && departmentPrograms.length === 0}
      >
        <option value="">All Programs</option>
        {departmentPrograms.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      <select
        value={filterSemester}
        onChange={(e) => onChange({ filterSemester: e.target.value })}
      >
        <option value="">All Semesters</option>
        {SEMESTERS.map((s) => (
          <option key={s} value={String(s)}>
            Semester {s}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button type="button" className="btn-ghost" onClick={onReset}>
          Reset
        </button>
      )}
    </div>
  );
}
