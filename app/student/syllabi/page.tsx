"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { SyllabusToolbar } from "@/app/components/syllabi/SyllabusToolbar";
import {
  useSyllabusGroups,
  type GroupedByDepartment,
} from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusPublicGroupedView } from "@/app/components/syllabi/SyllabusPublicGroupedView";
import { type ProgramsMeta, type SyllabusDto } from "@/app/lib/syllabi-shared";

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
  const [filterDept, setFilterDept] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "STUDENT") {
          router.replace("/");
          return;
        }
      } catch {
        router.replace("/");
        return;
      }
      try {
        const [listRes, metaRes] = await Promise.all([
          fetch("/api/syllabi"),
          fetch("/api/syllabi/meta"),
        ]);
        if (!listRes.ok) throw new Error("Unable to load syllabi");
        const listData = await listRes.json();
        setSyllabi(listData.syllabi ?? []);
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setMeta({
            departments: metaData.departments ?? [],
            programs: metaData.programs ?? [],
          });
          if (!filterDept && metaData.departments?.length) setFilterDept(metaData.departments[0]);
        }
      } catch (err) {
        setError((err as Error).message ?? "Unable to load syllabi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, filterDept]);

  const departmentPrograms = useMemo(() => {
    if (!filterDept) return meta.programs;
    return meta.programs.filter((p) => p.departmentName === filterDept);
  }, [meta.programs, filterDept]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return syllabi.filter((s) => {
      if (filterDept && s.departmentName !== filterDept) return false;
      if (filterProgram && s.programId !== filterProgram) return false;
      if (filterSemester && s.semester !== Number.parseInt(filterSemester, 10)) return false;
      if (term) {
        const haystack = `${s.title ?? ""} ${s.fileName} ${s.departmentName} ${s.programCode ?? ""} ${s.programName ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [syllabi, q, filterDept, filterProgram, filterSemester]);

  const groups: GroupedByDepartment[] = useSyllabusGroups(filtered, meta.programs);

  function resetFilters() {
    setQ("");
    setFilterDept("");
    setFilterProgram("");
    setFilterSemester("");
  }

  if (loading) {
    return (
      <StudentShell title="Syllabi" active="/student/syllabi">
        <p>Loading…</p>
      </StudentShell>
    );
  }

  return (
    <StudentShell title="Syllabi" active="/student/syllabi">
      <div>
        {error && <p className="notes-form-error">{error}</p>}

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
            Syllabus Library
          </h2>
          <SyllabusToolbar
            meta={meta}
            q={q}
            filterDept={filterDept}
            filterProgram={filterProgram}
            filterSemester={filterSemester}
            departmentPrograms={departmentPrograms}
            onChange={(p) => {
              if (p.q !== undefined) setQ(p.q);
              if (p.filterDept !== undefined) setFilterDept(p.filterDept);
              if (p.filterProgram !== undefined) setFilterProgram(p.filterProgram);
              if (p.filterSemester !== undefined) setFilterSemester(p.filterSemester);
            }}
            onReset={resetFilters}
          />
        </div>

        <SyllabusPublicGroupedView groups={groups} />

        {filtered.length === 0 && !error && (
          <div className="profile-info-card notes-empty">
            <h3>No syllabi found</h3>
            <p>
              {syllabi.length === 0
                ? "No syllabi are currently available."
                : "No syllabi match the selected filters. Try adjusting your search or filters."}
            </p>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
