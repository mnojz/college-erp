"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { SyllabusToolbar } from "@/app/components/syllabi/SyllabusToolbar";
import { useSyllabusProgramGroups } from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusProgramSections } from "@/app/components/syllabi/SyllabusProgramSections";
import { type ProgramsMeta, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { Skeleton } from "@/components/ui/skeleton";

type Syllabus = SyllabusDto;

export default function StudentSyllabiPage() {
  const router = useRouter();
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
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "STUDENT") {
          router.replace("/dashboard");
          return;
        }
      } catch {
        router.replace("/dashboard");
        return;
      }
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
  }, [router]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return syllabi.filter((s) => {
      if (filterProgram && s.programId !== filterProgram) return false;
      if (filterSemester && s.semester !== Number.parseInt(filterSemester, 10)) return false;
      if (term) {
        const haystack = `${s.title ?? ""} ${s.fileName} ${s.departmentName} ${s.programCode ?? ""} ${s.programName ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [syllabi, q, filterProgram, filterSemester]);

  const groups = useSyllabusProgramGroups(filtered, meta.programs);

  function resetFilters() {
    setQ("");
    setFilterProgram("");
    setFilterSemester("");
  }

  if (loading) {
    return (
      <StudentShell title="Syllabus" active="/student/syllabus">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </StudentShell>
    );
  }

  return (
    <StudentShell title="Syllabus" active="/student/syllabus">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <h2 className="text-lg font-semibold tracking-tight">Syllabus Library</h2>

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

        <SyllabusProgramSections variant="public" groups={groups} />

        {filtered.length === 0 && !error && (
          <div className="rounded-md border bg-muted/40 px-4 py-10 text-center">
            <h3 className="mb-1 text-sm font-semibold">No syllabus found</h3>
            <p className="text-sm text-muted-foreground">
              {syllabi.length === 0
                ? "No syllabus files are currently available."
                : "No syllabus files match the selected filters. Try adjusting your search or filters."}
            </p>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
