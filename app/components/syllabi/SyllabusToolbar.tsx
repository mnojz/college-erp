"use client";

import { SEMESTERS } from "@/app/lib/syllabi-shared";
import { IconFilterOff, IconSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <IconSearch
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="text"
          placeholder="Search title, program…"
          value={q}
          onChange={(e) => onChange({ q: e.target.value })}
          aria-label="Search syllabus"
          className="pl-9"
        />
      </div>
      <Select
        value={filterProgram}
        onValueChange={(value) => onChange({ filterProgram: value })}
        disabled={programs.length === 0}
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Filter by program">
          <SelectValue placeholder="All Programs" />
        </SelectTrigger>
        <SelectContent>
          {programs.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.code} — {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filterSemester}
        onValueChange={(value) => onChange({ filterSemester: value })}
      >
        <SelectTrigger className="w-full sm:w-40" aria-label="Filter by semester">
          <SelectValue placeholder="All Semesters" />
        </SelectTrigger>
        <SelectContent>
          {SEMESTERS.map((s) => (
            <SelectItem key={s} value={String(s)}>
              Semester {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <IconFilterOff size={14} aria-hidden="true" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
