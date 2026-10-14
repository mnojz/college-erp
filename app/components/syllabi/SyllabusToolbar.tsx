"use client";

import { SEMESTERS } from "@/app/lib/syllabi-shared";
import { IconFilterOff, IconSearch, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  programCounts?: Map<string, number>;
  totalCount?: number;
  onChange: (patch: Partial<Props>) => void;
  onReset: () => void;
}

/** Search bar + program/semester filter dropdowns with quick chips and active filter pills. */
export function SyllabusToolbar({
  q,
  filterProgram,
  filterSemester,
  programs,
  programCounts,
  totalCount,
  onChange,
  onReset,
}: Props) {
  const hasFilters = !!(q || filterProgram || filterSemester);
  const selectedProgramObj = programs.find((p) => p.id === filterProgram);

  return (
    <div className="space-y-3">
      {/* Program quick-filter chips */}
      {programs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => onChange({ filterProgram: "" })}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              !filterProgram
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            All Programs
            {totalCount !== undefined && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  !filterProgram
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {totalCount}
              </span>
            )}
          </button>

          {programs.map((p) => {
            const count = programCounts?.get(p.id) ?? 0;
            const isSelected = filterProgram === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ filterProgram: isSelected ? "" : p.id })}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{p.code}</span>
                {programCounts && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {count}/8
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main filter inputs box */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 sm:p-3 shadow-2xs backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-56 flex-1">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Search by title, subject, file name…"
              value={q}
              onChange={(e) => onChange({ q: e.target.value })}
              aria-label="Search syllabus"
              className="h-9 pl-9 pr-8 text-xs sm:text-sm bg-background/80"
            />
            {q && (
              <button
                type="button"
                onClick={() => onChange({ q: "" })}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          <Select
            value={filterProgram || "ALL"}
            onValueChange={(value) => onChange({ filterProgram: value === "ALL" ? "" : value })}
            disabled={programs.length === 0}
          >
            <SelectTrigger className="h-9 w-full sm:w-52 text-xs sm:text-sm bg-background/80" aria-label="Filter by program">
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Programs</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterSemester || "ALL"}
            onValueChange={(value) => onChange({ filterSemester: value === "ALL" ? "" : value })}
          >
            <SelectTrigger className="h-9 w-full sm:w-40 text-xs sm:text-sm bg-background/80" aria-label="Filter by semester">
              <SelectValue placeholder="All Semesters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Semesters</SelectItem>
              {SEMESTERS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  Semester {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              <IconFilterOff size={14} aria-hidden="true" />
              Reset
            </Button>
          )}
        </div>

        {/* Active filter pills */}
        {hasFilters && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground">Active Filters:</span>
            {q && (
              <Badge variant="secondary" className="gap-1 pl-2 pr-1.5 text-[11px] font-normal">
                Query: &quot;{q}&quot;
                <button
                  type="button"
                  onClick={() => onChange({ q: "" })}
                  className="rounded hover:bg-muted-foreground/20 p-0.5"
                >
                  <IconX size={11} />
                </button>
              </Badge>
            )}
            {selectedProgramObj && (
              <Badge variant="secondary" className="gap-1 pl-2 pr-1.5 text-[11px] font-normal">
                Program: {selectedProgramObj.code}
                <button
                  type="button"
                  onClick={() => onChange({ filterProgram: "" })}
                  className="rounded hover:bg-muted-foreground/20 p-0.5"
                >
                  <IconX size={11} />
                </button>
              </Badge>
            )}
            {filterSemester && (
              <Badge variant="secondary" className="gap-1 pl-2 pr-1.5 text-[11px] font-normal">
                Semester {filterSemester}
                <button
                  type="button"
                  onClick={() => onChange({ filterSemester: "" })}
                  className="rounded hover:bg-muted-foreground/20 p-0.5"
                >
                  <IconX size={11} />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
