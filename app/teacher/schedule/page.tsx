"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { MetricGridSkeleton, SectionSkeleton } from "@/app/components/layout/PageSkeletons";
import { TimetableGrid, type TimetableItem } from "@/app/components/timetable/TimetableGrid";
import { readShellIdentity, writeShellIdentity } from "@/app/lib/profile-cache";
import { campusDayOfWeek, campusNow } from "@/app/lib/campus-time";
import { formatTime, timeToMinutes } from "@/app/lib/timetable-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconCalendar,
  IconCalendarTime,
  IconClock,
  IconSearch,
  IconSparkles,
  IconCircleCheck,
  IconClockPlay,
  IconLayoutGrid,
  IconListCheck,
  IconBooks,
  IconHourglassHigh,
  IconCalendarCheck,
  IconChevronRight,
} from "@tabler/icons-react";

type ClassSchedule = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: { id: string; name: string; code: string };
  program: {
    id: string;
    name: string;
    code: string;
    departmentName: string;
  };
  semester: number;
};

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
  office?: string | null;
};

const WEEK_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;

type ViewMode = "agenda" | "grid" | "courses";

export default function TeacherSchedulePage() {
  const router = useRouter();

  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("agenda");
  const [selectedDay, setSelectedDay] = useState<string>("TODAY");
  const [searchQuery, setSearchQuery] = useState("");

  // Campus current wall-clock
  const currentCampus = useMemo(() => campusNow(), []);
  const todayDayName = useMemo(() => campusDayOfWeek(), []);

  useEffect(() => {
    async function loadSchedule() {
      const cached = readShellIdentity("teacher");
      if (cached) setTeacherInfo(cached);

      try {
        const response = await fetch("/api/teacher/profile");
        if (response.status === 401 || response.status === 403) {
          router.replace("/dashboard");
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to load teaching schedule");
          return;
        }

        setClasses(data.teacher?.classes ?? []);
        if (data.teacher) {
          const identity: TeacherInfo = {
            firstName: data.teacher.user.firstName,
            lastName: data.teacher.user.lastName,
            employeeNo: data.teacher.employeeNo,
            profileImageUrl: data.teacher.profileImageUrl,
            office: data.teacher.office,
          };
          setTeacherInfo(identity);
          writeShellIdentity("teacher", identity);
        }
      } catch {
        setError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, [router]);

  // Derived Metrics & Analytics
  const { totalHours, activeDaysCount, uniqueSubjectsCount, subjectGroupMap } = useMemo(() => {
    let totalMins = 0;
    const daysSet = new Set<string>();
    const subjectsMap = new Map<string, { code: string; name: string; count: number; hours: number; programs: Set<string> }>();

    for (const c of classes) {
      daysSet.add(c.dayOfWeek);
      const start = timeToMinutes(c.startTime) ?? 0;
      const end = timeToMinutes(c.endTime) ?? 0;
      const duration = Math.max(0, end - start);
      totalMins += duration;

      const existing = subjectsMap.get(c.subject.code);
      if (existing) {
        existing.count += 1;
        existing.hours += duration / 60;
        existing.programs.add(`${c.program.code} Sem ${c.semester}`);
      } else {
        subjectsMap.set(c.subject.code, {
          code: c.subject.code,
          name: c.subject.name,
          count: 1,
          hours: duration / 60,
          programs: new Set([`${c.program.code} Sem ${c.semester}`]),
        });
      }
    }

    return {
      totalHours: (totalMins / 60).toFixed(1),
      activeDaysCount: daysSet.size,
      uniqueSubjectsCount: subjectsMap.size,
      subjectGroupMap: Array.from(subjectsMap.values()),
    };
  }, [classes]);

  // Timetable items formatted for the shared TimetableGrid
  const timetableItems: TimetableItem[] = useMemo(() => {
    return classes.map((c) => ({
      id: c.id,
      dayOfWeek: c.dayOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      subject: { name: c.subject.name, code: c.subject.code },
      type: `${c.program.code} • Sem ${c.semester}`,
      subjectTeacherName: `Semester ${c.semester}`,
    }));
  }, [classes]);

  // Today's classes sorted by start time
  const todayClasses = useMemo(() => {
    return classes
      .filter((c) => c.dayOfWeek === todayDayName)
      .sort((a, b) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0));
  }, [classes, todayDayName]);

  // Find currently active session or next upcoming session today
  const { currentClass, nextClass } = useMemo(() => {
    const nowMins = currentCampus.minutes;
    let current: ClassSchedule | null = null;
    let next: ClassSchedule | null = null;

    for (const c of todayClasses) {
      const s = timeToMinutes(c.startTime) ?? 0;
      const e = timeToMinutes(c.endTime) ?? 0;

      if (nowMins >= s && nowMins < e) {
        current = c;
        break;
      }
      if (nowMins < s && !next) {
        next = c;
      }
    }

    return { currentClass: current, nextClass: next };
  }, [todayClasses, currentCampus]);

  // Filtered classes according to search and day
  const effectiveDay = selectedDay === "TODAY" ? todayDayName : selectedDay;
  const filteredClasses = useMemo(() => {
    let result = classes;

    // Filter by day if in agenda view
    if (viewMode === "agenda" && selectedDay !== "ALL") {
      result = result.filter((c) => c.dayOfWeek === effectiveDay);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.subject.name.toLowerCase().includes(q) ||
          c.subject.code.toLowerCase().includes(q) ||
          c.program.name.toLowerCase().includes(q) ||
          c.program.code.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0));
  }, [classes, viewMode, selectedDay, effectiveDay, searchQuery]);

  if (error) {
    return (
      <main className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-destructive">
        <p>{error}</p>
      </main>
    );
  }

  if (loading) {
    return (
      <TeacherShell
        active="/teacher/schedule"
        title="Weekly Teaching Schedule"
        subtitle="Teacher Timetable & Lectures"
        teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Teacher"}
        employeeNo={teacherInfo?.employeeNo}
        avatarUrl={teacherInfo?.profileImageUrl}
      >
        <div className="space-y-6">
          <MetricGridSkeleton count={4} />
          <SectionSkeleton rows={4} />
          <SectionSkeleton rows={4} />
        </div>
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      active="/teacher/schedule"
      title="Weekly Teaching Schedule"
      subtitle="Teacher Timetable & Lecture Roster"
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Teacher"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      <div className="space-y-6 pb-12">
        {/* ── 1. Top Header ────────────────────────────────────────────── */}
        <div className="border-b border-border/70 pb-4">
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconCalendarTime size={20} />
            </span>
            Teaching Schedule
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekly timetable and lecture routine.
          </p>
        </div>

        {/* ── 2. Top Metric Cards ────────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Weekly Lectures</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconCalendarTime size={16} />
              </span>
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tabular-nums">
              {classes.length}
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Contact Load</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconClock size={16} />
              </span>
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-primary tabular-nums">
              {totalHours} <span className="text-xs font-semibold text-muted-foreground">hrs</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Teaching Days</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IconCalendarCheck size={16} />
              </span>
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {activeDaysCount} <span className="text-xs font-semibold text-muted-foreground">days</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Courses</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <IconBooks size={16} />
              </span>
            </div>
            <div className="mt-1 text-2xl sm:text-3xl font-extrabold text-violet-600 dark:text-violet-400 tabular-nums">
              {uniqueSubjectsCount}
            </div>
          </div>
        </section>

        {/* ── 3. Live Campus Status Spotlight Card ─────────────────────────── */}
        <section className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-transparent text-xs font-bold px-2 py-0.5"
                >
                  <IconCalendarCheck size={12} className="mr-1" />
                  Today ({todayDayName.charAt(0) + todayDayName.slice(1).toLowerCase()})
                </Badge>

                {currentClass && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    In Session
                  </span>
                )}
                {!currentClass && nextClass && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <IconHourglassHigh size={12} />
                    Next Up
                  </span>
                )}
              </div>

              {currentClass ? (
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    {currentClass.subject.name} ({currentClass.subject.code})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(currentClass.startTime)} – {formatTime(currentClass.endTime)} • {currentClass.program.code} Sem {currentClass.semester}
                  </p>
                </div>
              ) : nextClass ? (
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    {nextClass.subject.name} ({nextClass.subject.code})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Starts at {formatTime(nextClass.startTime)} • {nextClass.program.code} Sem {nextClass.semester}
                  </p>
                </div>
              ) : todayClasses.length > 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconCircleCheck size={15} className="text-emerald-500" />
                  <span>All scheduled lectures for today completed.</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No lectures scheduled for today.
                </p>
              )}
            </div>

            {(currentClass || nextClass) && (
              <Button asChild size="sm" className="rounded-xl h-8.5 px-4 text-xs font-bold gap-1.5 shrink-0 self-start sm:self-auto shadow-xs">
                <Link href={`/teacher/attendance?classId=${(currentClass ?? nextClass)?.id}`}>
                  <IconClockPlay size={15} />
                  Take Attendance
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* ── 4. View Mode Switcher & Filter Toolbar ────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/70 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "agenda"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconListCheck size={15} />
              <span>Daily Timeline</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconLayoutGrid size={15} />
              <span>Weekly Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("courses")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "courses"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconBooks size={15} />
              <span>Course Modules</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <IconSearch
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder="Search subject or program..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl bg-card border-border/80 shadow-xs"
            />
          </div>
        </div>

        {/* ── 5. Main View Presentation ────────────────────────────────────── */}

        {/* VIEW 1: DAILY TIMELINE & AGENDA */}
        {viewMode === "agenda" && (
          <div className="space-y-4">
            {/* Day Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedDay("TODAY")}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  selectedDay === "TODAY"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
                }`}
              >
                <span>Today</span>
                <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
              </button>

              {WEEK_DAYS.map((day) => {
                const count = classes.filter((c) => c.dayOfWeek === day).length;
                const isSelected = selectedDay === day;
                const isToday = day === todayDayName;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
                    }`}
                  >
                    <span>{day.charAt(0) + day.slice(1).toLowerCase()}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                    {isToday && selectedDay !== "TODAY" && (
                      <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setSelectedDay("ALL")}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  selectedDay === "ALL"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
                }`}
              >
                All Days
              </button>
            </div>

            {/* List of Class Cards */}
            {filteredClasses.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20 space-y-2">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-muted mx-auto text-muted-foreground">
                  <IconCalendar size={22} />
                </span>
                <h4 className="text-sm font-bold text-foreground">No lectures scheduled</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {selectedDay === "ALL"
                    ? "No classes match your current search criteria."
                    : `There are no classes scheduled for ${effectiveDay.toLowerCase()}.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredClasses.map((item) => {
                  const startMins = timeToMinutes(item.startTime) ?? 0;
                  const endMins = timeToMinutes(item.endTime) ?? 0;

                  const isLiveToday =
                    item.dayOfWeek === currentCampus.day &&
                    currentCampus.minutes >= startMins &&
                    currentCampus.minutes < endMins;

                  const isCompletedToday =
                    item.dayOfWeek === currentCampus.day && currentCampus.minutes >= endMins;

                  return (
                    <div
                      key={item.id}
                      className={`group relative flex flex-col justify-between p-4 rounded-xl border bg-card transition-all duration-200 hover:shadow-xs ${
                        isLiveToday
                          ? "border-emerald-500/60 ring-1 ring-emerald-500/30 bg-emerald-500/3"
                          : isCompletedToday
                          ? "border-border/60 bg-muted/12"
                          : "border-border/70 hover:border-primary/40"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Top Row: Starting Time & Status Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground font-mono">
                            <IconClock size={13} className="text-primary" />
                            {formatTime(item.startTime)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {selectedDay === "ALL" && (
                              <Badge className="text-[10px] font-semibold py-0 px-1.5 border-0 bg-primary/15 text-primary">
                                {item.dayOfWeek.slice(0, 3)}
                              </Badge>
                            )}
                            {isLiveToday && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                              </span>
                            )}
                            {isCompletedToday && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground">
                                <IconCircleCheck size={12} className="text-emerald-500" />
                                Done
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subject Name */}
                        <h4 className="text-sm font-bold text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                          {item.subject.name}
                        </h4>
                      </div>

                      {/* Bottom: Subject Code & Cohort */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium pt-3 mt-3 border-t border-border/50">
                        <span className="font-mono text-foreground font-semibold">{item.subject.code}</span>
                        <span>•</span>
                        <span>{item.program.code}</span>
                        <span>•</span>
                        <span>Sem {item.semester}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: WEEKLY TIMETABLE GRID MATRIX */}
        {viewMode === "grid" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <IconCalendar size={15} className="text-primary" />
                  Full Weekly Matrix
                </span>
                <span>Click any block to review course cohort</span>
              </div>

              {/* Shared Timetable Grid Component */}
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <TimetableGrid
                  items={timetableItems}
                  readonly={true}
                  onBlockClick={() => {
                    router.push("/teacher/attendance");
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: COURSE MODULES OVERVIEW */}
        {viewMode === "courses" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectGroupMap.map((subj) => {
              return (
                <div
                  key={subj.code}
                  className="p-4 rounded-xl border border-border/70 bg-card shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/70">
                        {subj.code}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {subj.count} {subj.count === 1 ? "Session" : "Sessions"}/wk
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-foreground leading-snug">
                      {subj.name}
                    </h4>

                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Assigned Cohorts
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(subj.programs).map((prog) => (
                          <Badge key={prog} variant="secondary" className="text-[10px] font-medium">
                            {prog}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <IconSparkles size={13} className="text-amber-500" />
                      <span>{subj.hours.toFixed(1)} Contact Hours</span>
                    </div>

                    <Link
                      href="/teacher/attendance"
                      className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Attendance
                      <IconChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
