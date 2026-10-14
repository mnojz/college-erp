"use client";

import { useEffect, useMemo, useState } from "react";
import { SyllabusToolbar } from "@/app/components/syllabi/SyllabusToolbar";
import { useSyllabusProgramGroups } from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusProgramSections } from "@/app/components/syllabi/SyllabusProgramSections";
import { SyllabusPreviewModal } from "@/app/components/syllabi/SyllabusPreviewModal";
import { startProgress, doneProgress } from "@/app/components/layout/RouteProgress";
import { type ProgramsMeta, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { IconFileDescription } from "@tabler/icons-react";

type Syllabus = SyllabusDto;

export function PublicSyllabusLibrary() {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({
    departments: [],
    programs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewSyllabus, setPreviewSyllabus] = useState<Syllabus | null>(null);

  const [q, setQ] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  useEffect(() => {
    async function load() {
      try {
        startProgress();
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
        doneProgress();
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

  const groups = useSyllabusProgramGroups(filtered, meta.programs);

  const programCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of syllabi) {
      if (s.programId) {
        map.set(s.programId, (map.get(s.programId) ?? 0) + 1);
      }
    }
    return map;
  }, [syllabi]);

  function resetFilters() {
    setQ("");
    setFilterProgram("");
    setFilterSemester("");
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
            <div className="border-b bg-muted/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <div key={s} className="rounded-xl border border-dashed border-border/70 p-3 space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <SyllabusToolbar
            q={q}
            filterProgram={filterProgram}
            filterSemester={filterSemester}
            programs={meta.programs}
            programCounts={programCounts}
            totalCount={syllabi.length}
            onChange={(p) => {
              if (p.q !== undefined) setQ(p.q);
              if (p.filterProgram !== undefined) setFilterProgram(p.filterProgram);
              if (p.filterSemester !== undefined) setFilterSemester(p.filterSemester);
            }}
            onReset={resetFilters}
          />

          {filtered.length > 0 ? (
            <SyllabusProgramSections
              variant="public"
              groups={groups}
              onPreview={(s) => setPreviewSyllabus(s)}
            />
          ) : (
            !error && (
              <div className="rounded-2xl border border-dashed bg-card/60 p-12 text-center space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <IconFileDescription size={24} />
                </div>
                <h3 className="text-base font-semibold text-foreground">No syllabus found</h3>
                <p className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
                  {syllabi.length === 0
                    ? "No syllabus files are currently available in the public library."
                    : "No syllabus files match your search criteria. Try clearing or relaxing your filters."}
                </p>
                {hasActiveFilters(q, filterProgram, filterSemester) && (
                  <Button variant="outline" size="sm" onClick={resetFilters} className="mt-2">
                    Reset All Filters
                  </Button>
                )}
              </div>
            )
          )}
        </>
      )}

      {/* On-Page PDF Preview Modal */}
      <SyllabusPreviewModal
        syllabus={previewSyllabus}
        onClose={() => setPreviewSyllabus(null)}
      />
    </div>
  );
}

function hasActiveFilters(q: string, program: string, semester: string) {
  return !!(q || program || semester);
}
