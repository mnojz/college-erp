"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconBook2,
  IconCheck,
  IconLayersLinked,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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
  hasTheory?: boolean;
  hasPractical?: boolean;
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

interface Props {
  defaultProgramId?: string;
  currentSemester?: number | null;
  hideProgramSelector?: boolean;
}

export function StudentCourseStructurePanel({
  defaultProgramId,
  currentSemester,
  hideProgramSelector = false,
}: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programId, setProgramId] = useState("");
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [yearFilter, setYearFilter] = useState<"ALL" | number>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/programs")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load programs");
        return (data.programs ?? []) as Program[];
      })
      .then((loaded) => {
        setPrograms(loaded);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingPrograms(false));
  }, []);

  const programOptions = useMemo(
    () => [...programs].sort((a, b) => a.name.localeCompare(b.name)),
    [programs],
  );

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

  // Calculate totals
  const allCourses = useMemo(() => {
    if (!curriculum) return [];
    return curriculum.years.flatMap((y) => y.semesters.flatMap((s) => s.courses));
  }, [curriculum]);

  const totalDegreeCredits = useMemo(() => {
    return allCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
  }, [allCourses]);

  const totalSemesters = useMemo(() => {
    if (!curriculum) return 0;
    return curriculum.years.reduce((sum, y) => sum + y.semesters.length, 0);
  }, [curriculum]);

  // Filtered years
  const visibleYears = useMemo(() => {
    if (!curriculum) return [];
    let list = curriculum.years;
    if (yearFilter !== "ALL") {
      list = list.filter((y) => y.yearNo === yearFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list
        .map((year) => ({
          ...year,
          semesters: year.semesters
            .map((sem) => ({
              ...sem,
              courses: sem.courses.filter(
                (c) =>
                  (c.code && c.code.toLowerCase().includes(q)) ||
                  c.name.toLowerCase().includes(q),
              ),
            }))
            .filter((sem) => sem.courses.length > 0),
        }))
        .filter((year) => year.semesters.length > 0);
    }
    return list;
  }, [curriculum, yearFilter, searchQuery]);

  if (loadingPrograms) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Top Toolbar: Program Selection & Degree Overview ── */}
      {!hideProgramSelector && (
        <Card className="rounded-xl border border-border/70 p-4 shadow-xs bg-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <Select
                value={selectedId || undefined}
                onValueChange={setProgramId}
                disabled={programOptions.length === 0}
              >
                <SelectTrigger className="w-full sm:w-80 h-9 text-xs font-medium">
                  <IconLayersLinked size={14} className="text-primary mr-1.5 shrink-0" />
                  <SelectValue placeholder="Select Program..." />
                </SelectTrigger>
                <SelectContent>
                  {programOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Metrics Bar */}
            {selectedProgram && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs sm:text-sm py-1.5 px-3 bg-primary/10 text-primary border-transparent font-bold rounded-lg"
                >
                  <IconSparkles size={14} className="mr-1.5" />
                  {totalDegreeCredits} Total Credits
                </Badge>
                {currentSemester != null && (
                  <Badge
                    variant="outline"
                    className="text-xs sm:text-sm py-1.5 px-3 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent font-bold rounded-lg"
                  >
                    <IconCheck size={14} className="mr-1.5 text-emerald-500" />
                    Your Semester: {currentSemester}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Filter Toolbar: Year Pills & Course Search ── */}
      <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Year Filter Pills */}
          <div className="inline-flex flex-wrap rounded-xl border border-border/70 p-1 bg-muted/40">
            <button
              type="button"
              onClick={() => setYearFilter("ALL")}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                yearFilter === "ALL"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Years
            </button>
            {curriculum?.years.map((y) => (
              <button
                key={y.yearNo}
                type="button"
                onClick={() => setYearFilter(y.yearNo)}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                  yearFilter === y.yearNo
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {y.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72 lg:w-80">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search course title or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs sm:text-sm h-9.5"
            />
          </div>
        </div>
      </Card>

      {/* Error message */}
      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
          {error}
        </p>
      )}

      {/* Loading state */}
      {loadingCurriculum && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {/* ── Curriculum Structure Grid ── */}
      {!loadingCurriculum && curriculum && visibleYears.length === 0 && (
        <Card className="rounded-xl border-dashed p-10 text-center bg-card/60">
          <IconBook2 className="size-8 text-muted-foreground/40 mx-auto" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">No courses match your filter</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search query or selecting a different year tab.
          </p>
          {(searchQuery || yearFilter !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs font-medium"
              onClick={() => {
                setSearchQuery("");
                setYearFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </Card>
      )}

      {!loadingCurriculum && curriculum && visibleYears.length > 0 && (
        <div className="space-y-6">
          {visibleYears.map((year) => (
            <div key={year.id} className="space-y-3">
              {/* Year Heading */}
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                  {year.yearNo}
                </span>
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                  {year.label}
                </h3>
                <div className="h-px flex-1 bg-border/60 ml-2" />
              </div>

              {/* Semesters in this Year */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {year.semesters.map((semester) => {
                  const isCurrent =
                    currentSemester != null && semester.semesterNo === currentSemester;
                  const semCredits = semester.courses.reduce(
                    (sum, c) => sum + (c.credits || 0),
                    0,
                  );

                  return (
                    <Card
                      key={semester.id}
                      className={`rounded-xl border shadow-xs overflow-hidden transition-all ${
                        isCurrent
                          ? "border-primary/60 bg-linear-to-b from-primary/5 to-card ring-1 ring-primary/20"
                          : "border-border/70 bg-card hover:border-primary/30"
                      }`}
                    >
                      {/* Semester Card Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {semester.label}
                          </span>
                          {isCurrent && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold px-1.5 py-0 bg-primary/15 text-primary border-transparent"
                            >
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground text-[11px]">
                            {semester.courses.length} courses
                          </span>
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs font-bold px-2 py-0.5"
                          >
                            {semCredits} cr
                          </Badge>
                        </div>
                      </div>

                      {/* Courses List */}
                      <div className="divide-y divide-border/40">
                        {semester.courses.map((course) => (
                          <div
                            key={course.id}
                            className="flex items-center justify-between px-4 py-2 text-xs hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-3">
                              <span className="font-mono text-[11px] font-bold text-muted-foreground shrink-0 w-16">
                                {course.code ?? "—"}
                              </span>
                              <span
                                className="font-medium text-foreground truncate"
                                title={course.name}
                              >
                                {course.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Theory / Practical Pill */}
                              {course.hasTheory && course.hasPractical ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold px-1.5 py-0 border-transparent bg-muted/70 text-muted-foreground"
                                >
                                  TH+PR
                                </Badge>
                              ) : course.hasPractical ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold px-1.5 py-0 border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-400"
                                >
                                  PR
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold px-1.5 py-0 border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                >
                                  TH
                                </Badge>
                              )}
                              <span className="font-mono text-xs font-bold tabular-nums text-foreground w-8 text-right">
                                {course.credits} cr
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Semester Footer */}
                      <div className="px-4 py-2 border-t border-border/50 bg-muted/10 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span>Semester Credit Total</span>
                        <span className="font-bold font-mono text-foreground">
                          {semCredits} Credits
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {/* ── Electives Section ── */}
          {curriculum.electives && curriculum.electives.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                  ★
                </span>
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                  Program Electives
                </h3>
                <div className="h-px flex-1 bg-border/60 ml-2" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from(new Set(curriculum.electives.map((e) => e.group))).map((groupKey) => {
                  const items = curriculum.electives.filter((e) => e.group === groupKey);
                  if (items.length === 0) return null;
                  const label =
                    groupKey === "ELECTIVE_I"
                      ? "Elective I"
                      : groupKey === "ELECTIVE_II"
                      ? "Elective II"
                      : groupKey;

                  return (
                    <Card
                      key={groupKey}
                      className="rounded-xl border border-border/70 p-4 shadow-xs bg-card"
                    >
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/50">
                        <span className="text-xs font-bold text-foreground">{label}</span>
                        <Badge className="text-[10px] border-0 bg-primary/15 text-primary">
                          Choice of 1 Course
                        </Badge>
                      </div>
                      <div className="divide-y divide-border/40">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="font-mono text-[11px] text-muted-foreground shrink-0 w-16">
                                {item.code ?? "—"}
                              </span>
                              <span className="font-medium text-foreground truncate">
                                {item.name}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold tabular-nums text-foreground shrink-0">
                              {item.credits} cr
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
