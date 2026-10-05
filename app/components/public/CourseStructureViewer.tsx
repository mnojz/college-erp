"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Program = {
  id: string;
  name: string;
  code: string;
  durationYears: number;
  departmentName: string;
};

type CurriculumCourse = {
  id: string;
  code: string | null;
  name: string;
  credits: number;
  sortOrder: number;
};

type CurriculumSemester = {
  id: string;
  semesterNo: number;
  label: string;
  courses: CurriculumCourse[];
};

type CurriculumYear = {
  id: string;
  yearNo: number;
  label: string;
  semesters: CurriculumSemester[];
};

type CurriculumElective = {
  id: string;
  group: string;
  code: string | null;
  name: string;
  credits: number;
  sortOrder: number;
};

type Curriculum = {
  programId: string;
  years: CurriculumYear[];
  electives: CurriculumElective[];
};

export function CourseStructureViewer({
  defaultProgramId,
}: { defaultProgramId?: string } = {}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [error, setError] = useState("");

  const [programId, setProgramId] = useState("");
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);

  useEffect(() => {
    fetch("/api/programs")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load programs");
        return data.programs ?? [];
      })
      .then((loaded: Program[]) => {
        setPrograms(loaded);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoadingPrograms(false));
  }, []);

  const programOptions = useMemo(
    () => programs.sort((a, b) => a.name.localeCompare(b.name)),
    [programs],
  );

  // Open on a preferred program (e.g. the logged-in student's own) when it
  // really exists in the list; the picker still lets them switch freely.
  const selectedId =
    (programId && programOptions.some((p) => p.id === programId) ? programId : "") ||
    (defaultProgramId && programOptions.some((p) => p.id === defaultProgramId)
      ? defaultProgramId
      : "") ||
    programOptions[0]?.id ||
    "";

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingCurriculum(true);
      setError("");
      fetch(`/api/curriculum?programId=${selectedId}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Unable to load curriculum");
          return data.curriculum as Curriculum | null;
        })
        .then((data) => {
          if (!cancelled) setCurriculum(data);
        })
        .catch((reason: Error) => {
          if (!cancelled) setError(reason.message);
        })
        .finally(() => {
          if (!cancelled) setLoadingCurriculum(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedId]);

  const selectedProgram = programOptions.find((p) => p.id === selectedId);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Selectors */}
      <div className="mb-8">
        <label className="mb-2 block text-sm font-medium">Program</label>
        <Select value={selectedId || undefined} onValueChange={setProgramId} disabled={programOptions.length === 0}>
          <SelectTrigger className="w-full sm:w-96" aria-label="Program">
            <SelectValue placeholder="Loading…" />
          </SelectTrigger>
          <SelectContent>
            {programOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loadingCurriculum && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {!loadingCurriculum && curriculum && selectedProgram && (
        <div className="flex flex-col gap-8">
          <header>
            <h2 className="text-2xl font-semibold tracking-tight">{selectedProgram.name}</h2>
            {selectedProgram.departmentName && (
              <p className="mt-1 text-sm text-muted-foreground">{selectedProgram.departmentName}</p>
            )}
          </header>

          <div className="flex flex-col gap-8">
            {curriculum.years.map((year) => (
              <section key={year.id}>
                <h3 className="mb-3 text-base font-semibold text-muted-foreground">{year.label}</h3>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {year.semesters.map((semester) => {
                    const totalCredits = semester.courses.reduce(
                      (sum, c) => sum + c.credits,
                      0,
                    );
                    return (
                      <Card key={semester.id}>
                        <CardContent className="p-5">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{semester.label}</span>
                            <Badge variant="secondary">{totalCredits} cr</Badge>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left text-xs text-muted-foreground">
                                <th className="pb-2 pr-2 font-medium">Code</th>
                                <th className="pb-2 pr-2 font-medium">Course</th>
                                <th className="pb-2 text-right font-medium">Cr</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {semester.courses.map((course) => (
                                <tr key={course.id}>
                                  <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">
                                    {course.code ?? "—"}
                                  </td>
                                  <td className="py-2 pr-2">{course.name}</td>
                                  <td className="py-2 text-right tabular-nums">{course.credits}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t font-medium">
                                <td className="pt-2 pr-2" colSpan={2}>
                                  Semester Total
                                </td>
                                <td className="pt-2 text-right tabular-nums">{totalCredits}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {curriculum.electives && curriculum.electives.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold">Electives</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(["ELECTIVE_I", "ELECTIVE_II"] as const).map((group) => {
                  const items = curriculum.electives.filter(
                    (e) => e.group === group,
                  );
                  if (items.length === 0) return null;
                  return (
                    <Card key={group}>
                      <CardContent className="p-5">
                        <strong className="mb-3 block text-sm font-semibold">
                          {group === "ELECTIVE_I" ? "Elective-I" : "Elective-II"}
                        </strong>
                        <ul className="flex flex-col gap-2 text-sm">
                          {items.map((e) => (
                            <li key={e.id} className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{e.code ?? "—"}</span>
                              <span className="flex-1">{e.name}</span>
                              <span className="tabular-nums text-xs text-muted-foreground">{e.credits} cr</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!loadingCurriculum &&
        !loadingPrograms &&
        !error &&
        curriculum === null && (
          <p className="rounded-md border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            No curriculum published for this program yet.
          </p>
        )}
    </div>
  );
}
