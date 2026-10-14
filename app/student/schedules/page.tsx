"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBook2,
  IconCalendar,
  IconCalendarClock,
  IconCheck,
  IconClock,
  IconCoffee,
  IconLayoutGrid,
  IconList,
  IconSparkles,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { TimetableGrid, type TimetableItem } from "@/app/components/timetable/TimetableGrid";
import { getColorForSubject, formatTime } from "@/app/lib/timetable-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string; durationYears: number; departmentName?: string } | null;
};

type ProgramOption = { id: string; name: string; code: string; durationYears: number };

type ClassRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type?: string | null;
  group?: string | null;
  semester: number;
  programId: string;
  subject: { name: string; code: string };
  teacher: { employeeNo: string; user: { firstName: string; lastName: string } } | null;
};

type BreakRow = { id: string; programId: string; semester: number; startTime: string; endTime: string };

const DAYS_OF_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

export default function StudentSchedulesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "agenda" | "today">("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const todayDayName = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase(),
    []
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, programsRes, classesRes, breaksRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/programs"),
          fetch("/api/classes"),
          fetch("/api/breaks"),
        ]);

        if (!profileRes.ok || !programsRes.ok || !classesRes.ok || !breaksRes.ok) {
          router.replace("/dashboard");
          return;
        }

        const profileData = await profileRes.json();
        const programsData = await programsRes.json();
        const classesData = await classesRes.json();
        const breaksData = await breaksRes.json();

        const p: Profile = profileData.student;
        setProfile(p);
        setPrograms((programsData.programs ?? []) as ProgramOption[]);
        setClasses((classesData.classes ?? []) as ClassRow[]);
        setBreaks((breaksData.breaks ?? []) as BreakRow[]);

        const programId = p.program?.id ?? "";
        setSelectedProgramId(programId);
        setSelectedSemester(String(p.currentSemester ?? 1));
      } catch {
        setError("Unable to load class timetable");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;
  const semesterCount = selectedProgram ? selectedProgram.durationYears * 2 : 0;

  const breakPeriod = useMemo(() => {
    const match = breaks.find(
      (b) => b.programId === selectedProgramId && String(b.semester) === selectedSemester,
    );
    return match ? { start: match.startTime, end: match.endTime } : null;
  }, [breaks, selectedProgramId, selectedSemester]);

  const items: TimetableItem[] = useMemo(
    () =>
      classes
        .filter(
          (c) =>
            c.programId === selectedProgramId &&
            c.semester === Number(selectedSemester),
        )
        .map((c) => ({
          id: c.id,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          endTime: c.endTime,
          type: c.type,
          group: c.group,
          subject: c.subject,
          subjectTeacherName: c.teacher
            ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}`
            : undefined,
        })),
    [classes, selectedProgramId, selectedSemester],
  );

  // Distinct subjects in this routine
  const uniqueSubjects = useMemo(() => {
    const map = new Map<
      string,
      { code: string; name: string; teachers: Set<string>; count: number; labs: number }
    >();

    for (const item of items) {
      const code = item.subject.code;
      const current = map.get(code) ?? {
        code,
        name: item.subject.name,
        teachers: new Set<string>(),
        count: 0,
        labs: 0,
      };
      current.count += 1;
      if (item.type === "Practical") current.labs += 1;
      if (item.subjectTeacherName) current.teachers.add(item.subjectTeacherName);
      map.set(code, current);
    }

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [items]);

  const labCount = useMemo(
    () => items.filter((i) => i.type === "Practical").length,
    [items]
  );

  const isOwnRoutine =
    !!profile?.program &&
    profile.program.id === selectedProgramId &&
    profile.currentSemester === Number(selectedSemester);

  function resetToOwnRoutine() {
    if (profile?.program?.id) {
      setSelectedProgramId(profile.program.id);
      setSelectedSemester(String(profile.currentSemester ?? 1));
    }
  }

  if (error) {
    return (
      <StudentShell title="Class Schedules & Timetable" active="/student/schedules">
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive font-medium">
          {error}
        </p>
      </StudentShell>
    );
  }

  if (loading || !profile) {
    return (
      <StudentShell title="Class Schedules & Timetable" active="/student/schedules">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-18 w-full rounded-xl" />
            <Skeleton className="h-18 w-full rounded-xl" />
            <Skeleton className="h-18 w-full rounded-xl" />
            <Skeleton className="h-18 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId =
    profile.rollNumber != null ? String(profile.rollNumber) : profile.enrollmentNumber;

  // Filter items for today
  const todayClasses = items.filter((i) => i.dayOfWeek === todayDayName);

  return (
    <StudentShell
      active="/student/schedules"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Class Schedules & Timetable"
      subtitle="Weekly Academic Routine & Schedule"
    >
      <div className="space-y-5">
        {/* ── Academic Hero Header ── */}
        <Card className="rounded-2xl border border-border/70 shadow-xs bg-linear-to-r from-primary/10 via-primary/5 to-background p-4 sm:p-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <IconCalendarClock size={14} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Official Academic Routine
                </span>
              </div>
              <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {selectedProgram?.name ?? "Academic Program"} — Semester {selectedSemester || "—"}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Active timetable governed by campus dean and academic department.
              </p>
            </div>

            {/* Status Badge & Quick Jump */}
            <div className="flex items-center gap-2 shrink-0">
              {isOwnRoutine ? (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-xs shadow-xs">
                  <IconCheck size={14} className="text-emerald-500" />
                  <span>Your Active Routine</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs py-1 px-2.5 bg-muted/60">
                    <IconUsers size={13} className="mr-1 text-muted-foreground" />
                    Viewing Other Routine
                  </Badge>
                  {profile.program && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold px-2.5 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                      onClick={resetToOwnRoutine}
                    >
                      Jump to My Routine
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── Compact Metric Stat Strip ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Card 1: Total Classes */}
          <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Weekly Classes</span>
              <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconClock size={13} />
              </span>
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
              {items.length}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Across 5 working days
            </p>
          </Card>

          {/* Card 2: Distinct Subjects */}
          <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Scheduled Subjects</span>
              <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IconBook2 size={13} />
              </span>
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {uniqueSubjects.length}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Course modules taught
            </p>
          </Card>

          {/* Card 3: Practical Labs */}
          <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Lab Sessions</span>
              <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconSparkles size={13} />
              </span>
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
              {labCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Practical workshops
            </p>
          </Card>

          {/* Card 4: Break Window */}
          <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Campus Recess</span>
              <span className="flex size-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <IconCoffee size={13} />
              </span>
            </div>
            <div className="mt-1 text-xs sm:text-sm font-bold tracking-tight text-foreground truncate">
              {breakPeriod ? `${formatTime(breakPeriod.start)} – ${formatTime(breakPeriod.end)}` : "None Set"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Daily recess interval
            </p>
          </Card>
        </div>

        {/* ── Toolbar: Program & Semester Pickers + View Mode Toggle ── */}
        <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Dropdown Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Program:</span>
                <Select
                  value={selectedProgramId || undefined}
                  onValueChange={(value) => {
                    setSelectedProgramId(value);
                    setSelectedSemester("1");
                  }}
                  disabled={programs.length === 0}
                >
                  <SelectTrigger aria-label="Program" className="w-full sm:w-64 h-8.5 text-xs font-medium">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.code} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Semester:</span>
                <Select
                  value={selectedSemester || undefined}
                  onValueChange={setSelectedSemester}
                  disabled={!selectedProgramId}
                >
                  <SelectTrigger aria-label="Semester" className="w-full sm:w-36 h-8.5 text-xs font-medium">
                    <SelectValue placeholder="Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: semesterCount }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">
                        Semester {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <IconLayoutGrid size={13} />
                Weekly Matrix
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === "agenda"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <IconList size={13} />
                Day by Day
              </button>
              <button
                type="button"
                onClick={() => setViewMode("today")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === "today"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <IconCalendar size={13} />
                Today ({todayClasses.length})
              </button>
            </div>
          </div>
        </Card>

        {/* ── Main Timetable Views ── */}
        {selectedProgramId && selectedSemester ? (
          <div className="space-y-4">
            {/* VIEW 1: WEEKLY MATRIX (GRID) */}
            {viewMode === "grid" && (
              <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden bg-card">
                <CardContent className="p-4 sm:p-5">
                  <TimetableGrid items={items} breakPeriod={breakPeriod} readonly />
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed p-10 text-center bg-card/60 mt-3">
                      <IconCalendarClock className="size-8 text-muted-foreground/40 mx-auto" />
                      <h3 className="mt-2 text-sm font-semibold text-foreground">No classes scheduled</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        No timetable slots have been published for {selectedProgram?.code} · Semester {selectedSemester} yet.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* VIEW 2: DAY-BY-DAY AGENDA */}
            {viewMode === "agenda" && (
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day) => {
                  const isToday = todayDayName === day;
                  const dayItems = items
                    .filter((i) => i.dayOfWeek === day)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <Card
                      key={day}
                      className={`rounded-xl border shadow-xs overflow-hidden bg-card transition-all ${
                        isToday ? "border-primary/50 ring-1 ring-primary/20" : "border-border/70"
                      }`}
                    >
                      {/* Day Header */}
                      <div
                        className={`flex items-center justify-between px-4 py-2.5 border-b border-border/60 ${
                          isToday ? "bg-primary/5" : "bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconCalendar size={14} className={isToday ? "text-primary" : "text-muted-foreground"} />
                          <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                            {day}
                          </span>
                          {isToday && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold px-1.5 py-0 bg-primary/15 text-primary border-primary/30"
                            >
                              TODAY
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {dayItems.length} class{dayItems.length !== 1 ? "es" : ""}
                        </span>
                      </div>

                      {/* Day Classes */}
                      {dayItems.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground/70 italic">
                          No classes scheduled on this day
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {dayItems.map((c) => {
                            const color = getColorForSubject(c.subject.code);
                            return (
                              <div
                                key={c.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 sm:py-2.5 gap-2 hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className="font-mono text-xs font-bold px-1.5 py-0.5 rounded-sm shrink-0 border"
                                    style={{
                                      borderColor: color.border,
                                      backgroundColor: color.badgeBg,
                                      color: color.badgeText,
                                    }}
                                  >
                                    {c.subject.code}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-foreground truncate">
                                        {c.subject.name}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted/50">
                                        {c.type === "Practical" ? "Lab" : "Lecture"}
                                      </Badge>
                                      {c.group && (
                                        <Badge variant="secondary" className="text-[10px] py-0 px-1">
                                          Group {c.group}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <IconUser size={12} className="text-primary/70 shrink-0" />
                                      {c.subjectTeacherName || "Instructor unassigned"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <span className="font-mono text-xs font-semibold text-foreground px-2 py-1 rounded bg-muted/40">
                                    {formatTime(c.startTime)} – {formatTime(c.endTime)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* VIEW 3: TODAY'S CLASSES */}
            {viewMode === "today" && (
              <div className="space-y-3">
                <Card className="rounded-xl border border-primary/40 shadow-xs bg-linear-to-r from-primary/10 via-primary/5 to-background p-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Today&apos;s Focus
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-foreground">
                        {todayDayName} Classes ({todayClasses.length})
                      </h2>
                    </div>
                    <Badge variant="outline" className="border-primary/40 bg-primary/15 text-primary text-xs font-bold px-2.5 py-1">
                      {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </Badge>
                  </div>
                </Card>

                {todayClasses.length === 0 ? (
                  <Card className="rounded-xl border-dashed p-10 text-center bg-card/60">
                    <IconCoffee className="size-8 text-amber-500/80 mx-auto" />
                    <h3 className="mt-2 text-sm font-semibold text-foreground">No classes today!</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      You have no classes scheduled for {todayDayName.toLowerCase()}. Enjoy your free time or revise coursework.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2.5">
                    {todayClasses
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((c) => {
                        const color = getColorForSubject(c.subject.code);
                        return (
                          <Card
                            key={c.id}
                            className="rounded-xl border border-border/70 p-3.5 shadow-xs bg-card hover:border-primary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="font-mono text-xs font-bold px-2 py-1 rounded-sm border shrink-0"
                                style={{
                                  borderColor: color.border,
                                  backgroundColor: color.badgeBg,
                                  color: color.badgeText,
                                }}
                              >
                                {c.subject.code}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs sm:text-sm font-bold text-foreground">
                                    {c.subject.name}
                                  </h4>
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted/60">
                                    {c.type === "Practical" ? "Lab" : "Lecture"}
                                  </Badge>
                                </div>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <IconUser size={12} className="text-primary/70 shrink-0" />
                                  {c.subjectTeacherName || "Instructor unassigned"}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                              <span className="font-mono text-xs font-bold text-foreground px-2.5 py-1 rounded-md bg-muted/60 border border-border/50">
                                {formatTime(c.startTime)} – {formatTime(c.endTime)}
                              </span>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <Card className="rounded-xl border-dashed p-10 text-center bg-card/60">
            <IconCalendarClock className="size-8 text-muted-foreground/40 mx-auto" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">No timetable selected</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Select an academic program and semester above to inspect its weekly schedule.
            </p>
          </Card>
        )}
      </div>
    </StudentShell>
  );
}
