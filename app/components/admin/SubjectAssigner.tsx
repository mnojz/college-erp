"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";

export type SubjectOption = {
  id: string;
  name: string;
  code: string;
  semester: number;
  program?: { code: string; name: string } | null;
};

export function SubjectAssigner({
  subjects,
  assignedIds,
  onChange,
}: {
  subjects: SubjectOption[];
  assignedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [programFilter, setProgramFilter] = useState("ALL");

  const assigned = subjects.filter((s) => assignedIds.includes(s.id));
  const q = query.trim().toLowerCase();
  const visible = subjects.filter((s) => {
    if (programFilter !== "ALL" && (s.program?.code ?? "") !== programFilter) return false;
    if (semesterFilter !== "ALL" && String(s.semester) !== semesterFilter) return false;
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.program?.code ?? "").toLowerCase().includes(q) ||
      (s.program?.name ?? "").toLowerCase().includes(q)
    );
  });

  const semesters = useMemo(
    () => Array.from(new Set(subjects.map((s) => s.semester))).sort((a, b) => a - b),
    [subjects],
  );

  const programs = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string }>();
    for (const s of subjects) {
      if (s.program && !byCode.has(s.program.code)) {
        byCode.set(s.program.code, s.program);
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [subjects]);

  const filtersActive = programFilter !== "ALL" || semesterFilter !== "ALL";
  const activeFilterLabel = [
    programFilter !== "ALL" ? `program ${programFilter}` : "",
    semesterFilter !== "ALL" ? `semester ${semesterFilter}` : "",
    q ? `“${query.trim()}”` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Label>Assigned subjects</Label>
        <span className="text-xs text-muted-foreground">
          Drives automatic class scheduling
        </span>
      </div>

      {assigned.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No subjects assigned yet. Click “Assign Subject” below to add one.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {assigned.map((s) => (
            <Badge
              key={s.id}
              className="h-auto gap-1.5 py-1 pr-1 font-normal border-0 bg-primary/15 text-primary"
            >
              <span className="font-semibold">{s.code}</span>
              <span className="text-primary/90">{s.name}</span>
              <span className="text-primary/75">
                · Sem {s.semester}
                {s.program ? ` · ${s.program.code}` : ""}
              </span>
              <button
                type="button"
                title={`Remove ${s.code} from this teacher`}
                aria-label={`Remove ${s.code}`}
                onClick={() => onChange(assignedIds.filter((id) => id !== s.id))}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
              >
                <IconX size={12} aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          variant={pickerOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setPickerOpen((v) => !v)}
        >
          {pickerOpen ? (
            "Done"
          ) : (
            <>
              <IconPlus size={15} aria-hidden="true" />
              Assign Subject
            </>
          )}
        </Button>
        {assigned.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {assigned.length} of {subjects.length} assigned
          </span>
        )}
      </div>

      {pickerOpen && (
        <div className="grid gap-2.5 rounded-lg border bg-card p-3">
          <div className="relative">
            <IconSearch
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 z-[1] -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search by code, name, or program…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Program</Label>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ALL">All programs</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Semester</Label>
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ALL">All semesters</SelectItem>
                  {semesters.map((sem) => (
                    <SelectItem key={sem} value={String(sem)}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtersActive && (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setProgramFilter("ALL");
                    setSemesterFilter("ALL");
                  }}
                  className="text-xs"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>

          {activeFilterLabel && (
            <p className="text-[11px] text-muted-foreground">
              Filtering by: <span className="font-medium text-foreground">{activeFilterLabel}</span>
              {" — "}
              {visible.length} {visible.length === 1 ? "match" : "matches"}
            </p>
          )}

          <div className="max-h-48 overflow-y-auto rounded border divide-y text-xs">
            {visible.length === 0 ? (
              <p className="p-3 text-center text-muted-foreground">
                No subjects match your query.
              </p>
            ) : (
              visible.map((s) => {
                const isSelected = assignedIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onChange(assignedIds.filter((id) => id !== s.id));
                      } else {
                        onChange([...assignedIds, s.id]);
                      }
                    }}
                    className={`flex w-full items-center justify-between p-2 text-left transition-colors hover:bg-muted/50 ${
                      isSelected ? "bg-primary/10 font-medium" : ""
                    }`}
                  >
                    <div>
                      <span className="font-mono font-semibold">{s.code}</span>
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      <span>{s.name}</span>
                      <span className="ml-2 text-muted-foreground">
                        (Sem {s.semester}
                        {s.program ? `, ${s.program.code}` : ""})
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        isSelected
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isSelected ? "Assigned" : "Assign"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

