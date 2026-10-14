"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { startProgress, doneProgress } from "@/app/components/layout/RouteProgress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowsShuffle,
  IconCalendarCheck,
  IconCalendarEvent,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconClock,
  IconFilterOff,
  IconLock,
  IconPencil,
  IconSearch,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceMeter } from "@/app/components/teacher/AttendanceMeter";
import { TeacherAttendanceRecords } from "@/app/components/teacher/TeacherAttendanceRecords";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { CAMPUS_TIME_ZONE, campusNow, campusTodayISO } from "@/app/lib/campus-time";
import { formatTime } from "@/app/lib/timetable-layout";

type Student = {
  id: string;
  enrollmentNumber: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  /** `user.status` — INACTIVE means an admin deactivated this account. */
  user: { firstName: string; lastName: string; status: string };
  /** Subject-scoped roll call: PRESENT days over sessions held for this class. */
  attendance: { present: number; total: number };
};

type ClassItem = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  type: string;
  group: string | null;
  hasTodaySession?: boolean;
  subject: { code: string; name: string };
  program: {
    id: string;
    name: string;
    code: string;
    students: Student[];
  };
};

/**
 * A student whose ACCOUNT was deactivated (User.status !== "ACTIVE"). They
 * stay listed on the roll - you need to see them - but can never be marked
 * present. The enrollment lifecycle (graduated/suspended/withdrawn) is already
 * filtered out server-side, so it never reaches this list.
 */
function isAccountInactive(student: Student) {
  return student.user.status !== "ACTIVE";
}

/** Time-of-day (in minutes since midnight) extracted straight from the ISO string. */
function timeToMinutes(timeStr: string): number {
  const match = timeStr.match(/T(\d{2}):(\d{2})/);
  return match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : 0;
}

/** Pure filter helper shared by the memoized `filteredClasses` and event handlers. */
function filterClassesFor(
  classes: ClassItem[],
  programId: string,
  semester: string,
): ClassItem[] {
  return classes.filter((c) => {
    if (programId !== "ALL" && c.program.id !== programId) return false;
    if (semester !== "ALL" && c.semester !== Number(semester)) return false;
    return true;
  });
}

/**
 * Determine which class is currently in session for this teacher.
 * Matches today's DayOfWeek and checks if the current time falls within
 * the class's startTime–endTime window. Falls back to the first class.
 */
function findCurrentClassId(classes: ClassItem[]): string {
  if (classes.length === 0) return "";

  const { day: todayKey, minutes: currentTimeMinutes } = campusNow();

  // Look for a class that matches today and whose time window contains now.
  for (const c of classes) {
    if (c.dayOfWeek !== todayKey) continue;
    const startMin = timeToMinutes(c.startTime);
    const endMin = timeToMinutes(c.endTime);
    if (currentTimeMinutes >= startMin && currentTimeMinutes <= endMin) {
      return c.id;
    }
  }

  // Fallback: first class on today's date, then first class overall.
  const todayClass = classes.find((c) => c.dayOfWeek === todayKey);
  return (todayClass ?? classes[0]).id;
}

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
};

export default function TeacherAttendancePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /** Filter bar state — narrows the class dropdown by program/semester. */
  const [selectedProgram, setSelectedProgram] = useState("ALL");
  const [selectedSemester, setSelectedSemester] = useState("ALL");

  /**
   * Attendance session lifecycle. Attendance is always recorded for TODAY —
   * there is deliberately no date picker (attendance cannot be taken in
   * advance or retroactively from this page; the date is shown read-only).
   *
   *  idle      → nothing saved today yet; the primary button submits.
   *  submitted → saved; the button turns into "Edit" until the 5-minute
   *              lock window (counted from the FIRST submission) closes.
   *  editing   → the teacher is correcting a submitted session; the button
   *              turns back into "Update" until saved again.
   */
  const [sessionStatus, setSessionStatus] = useState<"idle" | "submitted" | "editing">("idle");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  /** Client clock, set in an effect so render stays pure (purity lint rule). */
  const [now, setNow] = useState<number | null>(null);

  /** Active top-level tab: 'mark' (live roll call) or 'records' (subject attendance analytics) */
  const [activeTab, setActiveTab] = useState<"mark" | "records">("mark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam === "records" || tabParam === "history") {
        setTimeout(() => setActiveTab("records"), 0);
      }
    }
  }, []);

  function handleTabChange(value: string) {
    const next = value === "records" ? "records" : "mark";
    setActiveTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "records") {
        url.searchParams.set("tab", "records");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState(null, "", url.toString());
    }
  }

  /** Attendance is always for the current day — shown as read-only info. */
  const todayISO = campusTodayISO();
  const { day: todayKey } = campusNow();
  const displayDayName = todayKey.charAt(0) + todayKey.slice(1).toLowerCase();

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  /** Minutes after the FIRST submission during which edits remain possible. */
  const EDIT_WINDOW_MINUTES = 5;
  const editWindowEndsAt = submittedAt
    ? new Date(new Date(submittedAt).getTime() + EDIT_WINDOW_MINUTES * 60_000)
    : null;
  const isLocked = Boolean(editWindowEndsAt && now !== null && now >= editWindowEndsAt.getTime());

  /**
   * Live "time left" on the edit window, e.g. "4:37". Null until the client
   * clock has ticked once, so the first paint stays hydration-safe.
   */
  const remainingLabel =
    editWindowEndsAt && now !== null
      ? (() => {
          const ms = Math.max(0, editWindowEndsAt.getTime() - now);
          return `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
        })()
      : null;

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId],
  );

  /** Today's scheduled classes */
  const todaysScheduledClasses = useMemo(() => {
    return classes.filter((c) => c.dayOfWeek === todayKey);
  }, [classes, todayKey]);

  /** Dropdown value: the distinct-subject key the selected class belongs to. */
  const selectedSubjectKey = selectedClass
    ? `${selectedClass.program.id}|${selectedClass.semester}|${selectedClass.subject.code}`
    : "";

  /** Distinct programs for the filter dropdown (sorted by code). */
  const availablePrograms = useMemo(() => {
    const seen = new Map<string, { id: string; code: string; name: string }>();
    for (const c of classes) {
      if (!seen.has(c.program.id)) {
        seen.set(c.program.id, { id: c.program.id, code: c.program.code, name: c.program.name });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [classes]);

  /** Distinct semesters offered within the currently selected program. */
  const availableSemesters = useMemo(() => {
    const sems = new Set<number>();
    for (const c of classes) {
      if (selectedProgram === "ALL" || c.program.id === selectedProgram) {
        sems.add(c.semester);
      }
    }
    return Array.from(sems).sort((a, b) => a - b);
  }, [classes, selectedProgram]);

  /** Classes narrowed by the filter bar. */
  const filteredClasses = useMemo(
    () => filterClassesFor(classes, selectedProgram, selectedSemester),
    [classes, selectedProgram, selectedSemester],
  );

  /** One dropdown entry per SUBJECT */
  const subjectOptions = useMemo(() => {
    const subjects = new Map<string, { key: string; label: string; hasPractical: boolean }>();
    for (const c of filteredClasses) {
      const key = `${c.program.id}|${c.semester}|${c.subject.code}`;
      const isPractical = c.type === "Practical";
      const existing = subjects.get(key);
      if (existing) {
        if (isPractical) existing.hasPractical = true;
        continue;
      }
      subjects.set(key, {
        key,
        label: `[${c.program.code} · Sem ${c.semester}] ${c.subject.name} (${c.subject.code})`,
        hasPractical: isPractical,
      });
    }
    return Array.from(subjects.values());
  }, [filteredClasses]);

  function syncSelectedClassWith(nextFiltered: ClassItem[]) {
    if (nextFiltered.length === 0) {
      if (selectedClassId) {
        setSelectedClassId("");
        setPresentStudentIds(new Set());
      }
      return;
    }
    if (selectedClassId && !nextFiltered.some((c) => c.id === selectedClassId)) {
      const next = findCurrentClassId(nextFiltered) || nextFiltered[0].id;
      setSelectedClassId(next);
      setMessage("");
      setError("");
      void loadExistingSession(next);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        startProgress();
        const [attRes, profRes] = await Promise.all([
          fetch("/api/attendance"),
          fetch("/api/teacher/profile"),
        ]);

        if (attRes.status === 403 || attRes.status === 401 || profRes.status === 403 || profRes.status === 401) {
          router.replace("/dashboard");
          return;
        }

        const attResult = await attRes.json();
        const profResult = await profRes.json();

        if (!attRes.ok) {
          setError(attResult.error ?? "Unable to load classes");
          return;
        }

        const loadedClasses: ClassItem[] = attResult.classes ?? [];
        setClasses(loadedClasses);

        // Smart-default: if classId is provided in URL, preselect it; otherwise find the class currently in session.
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const urlClassId = urlParams?.get("classId");
        const matchedClass = urlClassId ? loadedClasses.find((c) => c.id === urlClassId) : null;
        const initialClassId = matchedClass?.id ?? findCurrentClassId(loadedClasses) ?? "";

        if (matchedClass) {
          setSelectedProgram(matchedClass.program.id);
          setSelectedSemester(String(matchedClass.semester));
        }
        setSelectedClassId(initialClassId);
        await loadExistingSession(initialClassId);

        if (profRes.ok && profResult.teacher) {
          setTeacherInfo({
            firstName: profResult.teacher.user.firstName,
            lastName: profResult.teacher.user.lastName,
            employeeNo: profResult.teacher.employeeNo,
            profileImageUrl: profResult.teacher.profileImageUrl,
          });
        }
      } catch {
        setError("Unable to reach the server");
      } finally {
        setIsLoading(false);
        doneProgress();
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!submittedAt || isLocked) return;
    const sync = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(sync);
      clearInterval(timer);
    };
  }, [submittedAt, isLocked]);

  const savedMarksRef = useRef<Set<string>>(new Set());

  function applyAttendanceDelta(
    classId: string,
    deltaFor: (student: Student) => { present: number; total: number },
  ) {
    setClasses((prev) =>
      prev.map((c) =>
        c.id !== classId
          ? c
          : {
              ...c,
              hasTodaySession: true,
              program: {
                ...c.program,
                students: c.program.students.map((s) => {
                  const delta = deltaFor(s);
                  return {
                    ...s,
                    attendance: {
                      present: s.attendance.present + delta.present,
                      total: s.attendance.total + delta.total,
                    },
                  };
                }),
              },
            },
      ),
    );
  }

  function toggleStudent(studentId: string) {
    const target = selectedClass?.program.students.find((s) => s.id === studentId);
    if (target && isAccountInactive(target)) return;
    setPresentStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function markStudentPresent(studentId: string) {
    const target = selectedClass?.program.students.find((s) => s.id === studentId);
    if (target && isAccountInactive(target)) return;
    setPresentStudentIds((current) => {
      const next = new Set(current);
      next.add(studentId);
      return next;
    });
  }

  function markStudentAbsent(studentId: string) {
    setPresentStudentIds((current) => {
      const next = new Set(current);
      next.delete(studentId);
      return next;
    });
  }

  function selectClass(classId: string) {
    setSelectedClassId(classId);
    const target = classes.find((c) => c.id === classId);
    if (target) {
      setSelectedProgram(target.program.id);
      setSelectedSemester(String(target.semester));
    }
    setMessage("");
    setError("");
    void loadExistingSession(classId);
  }

  function selectSubject(subjectKey: string) {
    const [progId, semStr, base] = subjectKey.split("|");
    if (!progId || !semStr || !base) return;
    const candidates = filteredClasses.filter(
      (c) =>
        c.program.id === progId &&
        c.semester === Number(semStr) &&
        c.subject.code === base,
    );
    if (candidates.length === 0) return;
    selectClass(findCurrentClassId(candidates) || candidates[0].id);
  }

  function resetFilters() {
    setSelectedProgram("ALL");
    setSelectedSemester("ALL");
    syncSelectedClassWith(filterClassesFor(classes, "ALL", "ALL"));
  }

  function handleProgramChange(value: string) {
    setSelectedProgram(value);
    setSelectedSemester("ALL");
    syncSelectedClassWith(filterClassesFor(classes, value, "ALL"));
  }

  function handleSemesterChange(value: string) {
    setSelectedSemester(value);
    syncSelectedClassWith(filterClassesFor(classes, selectedProgram, value));
  }

  function selectAll() {
    if (!selectedClass) return;
    setPresentStudentIds(
      new Set(selectedClass.program.students.filter((s) => !isAccountInactive(s)).map((s) => s.id)),
    );
  }

  function clearAll() {
    setPresentStudentIds(new Set());
  }

  function invertSelection() {
    if (!selectedClass) return;
    const activeStudents = selectedClass.program.students.filter((s) => !isAccountInactive(s));
    setPresentStudentIds((current) => {
      const next = new Set<string>();
      for (const s of activeStudents) {
        if (!current.has(s.id)) next.add(s.id);
      }
      return next;
    });
  }

  async function loadExistingSession(classId: string) {
    const resetToIdle = () => {
      setSessionStatus("idle");
      setSubmittedAt(null);
      setPresentStudentIds(new Set());
      savedMarksRef.current = new Set();
    };
    if (!classId) {
      resetToIdle();
      return;
    }
    try {
      const res = await fetch(`/api/attendance?classId=${classId}&date=${todayISO}`);
      if (!res.ok) {
        resetToIdle();
        return;
      }
      const data = await res.json();
      if (data.session) {
        setSubmittedAt(data.session.createdAt ?? null);
        setSessionStatus("submitted");
        const inactiveIds = new Set(
          (classes.find((c) => c.id === classId)?.program.students ?? [])
            .filter(isAccountInactive)
            .map((s) => s.id),
        );
        const marks = new Set<string>(
          (data.session.records ?? [])
            .filter((r: { status: string }) => r.status === "PRESENT")
            .map((r: { studentId: string }) => r.studentId)
            .filter((studentId: string) => !inactiveIds.has(studentId)),
        );
        setPresentStudentIds(marks);
        savedMarksRef.current = marks;
      } else {
        resetToIdle();
      }
    } catch {
      resetToIdle();
    }
  }

  async function submitAttendance() {
    if (!selectedClass) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const wasEditing = sessionStatus === "editing";
      const response = await fetch("/api/attendance", {
        method: wasEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass.id,
          sessionDate: todayISO,
          presentStudentIds: [...presentStudentIds],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to submit attendance");
        if (result.session || result.locked) {
          await loadExistingSession(selectedClass.id);
        }
        return;
      }
      setSubmittedAt(result.session?.createdAt ?? new Date().toISOString());
      setSessionStatus("submitted");

      if (wasEditing) {
        const previousMarks = savedMarksRef.current;
        applyAttendanceDelta(selectedClass.id, (s) => ({
          present:
            (presentStudentIds.has(s.id) ? 1 : 0) - (previousMarks.has(s.id) ? 1 : 0),
          total: 0,
        }));
      } else {
        applyAttendanceDelta(selectedClass.id, (s) => ({
          present: presentStudentIds.has(s.id) ? 1 : 0,
          total: 1,
        }));
      }
      savedMarksRef.current = new Set(presentStudentIds);
      const total = selectedClass.program.students.length;
      const present = presentStudentIds.size;
      setMessage(
        wasEditing
          ? `Attendance updated: ${present} Present, ${total - present} Absent.`
          : `Attendance successfully recorded: ${present} Present, ${total - present} Absent.`,
      );
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalStudents = selectedClass?.program.students.length ?? 0;
  const presentCount = presentStudentIds.size;
  const absentCount = totalStudents - presentCount;
  const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(0) : "0";

  // Filter & sort roster
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    const byRoll = (a: Student, b: Student) => {
      if (a.rollNumber != null && b.rollNumber == null) return -1;
      if (a.rollNumber == null && b.rollNumber != null) return 1;
      if (a.rollNumber != null && b.rollNumber != null && a.rollNumber !== b.rollNumber) {
        return a.rollNumber - b.rollNumber;
      }
      return a.enrollmentNumber.localeCompare(b.enrollmentNumber);
    };

    let roster = selectedClass.program.students;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      roster = roster.filter(
        (s) =>
          s.user.firstName.toLowerCase().includes(q) ||
          s.user.lastName.toLowerCase().includes(q) ||
          s.enrollmentNumber.toLowerCase().includes(q) ||
          (s.rollNumber != null && String(s.rollNumber).includes(q)),
      );
    }

    if (statusFilter === "PRESENT") {
      roster = roster.filter((s) => presentStudentIds.has(s.id));
    } else if (statusFilter === "ABSENT") {
      roster = roster.filter((s) => !presentStudentIds.has(s.id));
    }

    return [...roster].sort(byRoll);
  }, [selectedClass, searchQuery, statusFilter, presentStudentIds]);

  return (
    <TeacherShell
      active="/teacher/attendance"
      title="Class Attendance Management"
      subtitle={
        activeTab === "records"
          ? "Subject Records & Analytics"
          : "Daily Roll Call Checklist"
      }
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Faculty Member"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <div className="flex border-b border-border/80 pb-3">
          <TabsList className="h-10 bg-muted/60 p-1">
            <TabsTrigger
              value="mark"
              className="gap-2 px-4 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconCalendarEvent className="size-4" aria-hidden="true" />
              Take Today&apos;s Attendance
            </TabsTrigger>
            <TabsTrigger
              value="records"
              className="gap-2 px-4 py-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <IconClipboardList className="size-4" aria-hidden="true" />
              Subject Records &amp; Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="mark" className="space-y-6">
          {/* ── 1. Today's Scheduled Classes (Quick Switcher) ── */}
          {todaysScheduledClasses.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconCalendarCheck size={16} className="text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Today&apos;s Routine ({displayDayName}) — Quick Class Switcher
                  </h3>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {todaysScheduledClasses.length} lecture{todaysScheduledClasses.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {todaysScheduledClasses.map((cls) => {
                  const isSelected = cls.id === selectedClassId;
                  const isDone = cls.hasTodaySession;

                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => selectClass(cls.id)}
                      className={`group relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {formatTime(cls.startTime)}
                          </span>
                          <span className="text-muted-foreground text-[10px]">to {formatTime(cls.endTime)}</span>
                        </div>

                        {isDone ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold gap-1"
                          >
                            <IconCircleCheck size={11} /> Recorded
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold gap-1"
                          >
                            <IconClock size={11} /> Pending
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground">
                            {cls.subject.code}
                          </span>
                          <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {cls.subject.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {cls.program.code} • Sem {cls.semester} ({cls.program.students.length} students)
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── 2. Manual Class Selector & Filter Bar ── */}
          <section className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconCalendarEvent size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Class Selection</h2>
                  <p className="text-xs text-muted-foreground">
                    Filter by program and semester to open any teaching roster.
                  </p>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1 text-xs font-semibold text-primary"
                title="Attendance is recorded for today only"
              >
                <IconCalendarEvent size={14} aria-hidden="true" />
                {todayLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 items-end gap-3.5 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-[0.9fr_0.9fr_1.7fr_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="att-filter-program" className="text-xs font-semibold">Program</Label>
                <Select
                  value={selectedProgram}
                  onValueChange={handleProgramChange}
                  disabled={isLoading || availablePrograms.length === 0}
                >
                  <SelectTrigger id="att-filter-program" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Programs</SelectItem>
                    {availablePrograms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="att-filter-semester" className="text-xs font-semibold">Semester</Label>
                <Select
                  value={selectedSemester}
                  onValueChange={handleSemesterChange}
                  disabled={isLoading || availableSemesters.length === 0}
                >
                  <SelectTrigger id="att-filter-semester" className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Semesters</SelectItem>
                    {availableSemesters.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        Semester {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="att-filter-subject" className="text-xs font-semibold">Subject / Roster</Label>
                <Select
                  value={selectedSubjectKey || undefined}
                  onValueChange={selectSubject}
                  disabled={isLoading || filteredClasses.length === 0}
                >
                  <SelectTrigger id="att-filter-subject" className="w-full text-xs">
                    <SelectValue placeholder="No matching classes found" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                        {opt.hasPractical ? " · practical" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetFilters}
                disabled={selectedProgram === "ALL" && selectedSemester === "ALL"}
                title="Reset filters"
                className="h-9 px-3"
              >
                <IconFilterOff size={15} aria-hidden="true" />
              </Button>
            </div>
          </section>

          {/* ── 3. Turnout Metrics Summary ── */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <article className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Enrolled
                </span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconUsers size={16} aria-hidden="true" />
                </span>
              </div>
              <strong className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
                {totalStudents}
              </strong>
              <p className="text-[11px] text-muted-foreground">
                In {selectedClass?.program.code ?? "class"}
              </p>
            </article>

            <article className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Present
                </span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <IconCircleCheck size={16} aria-hidden="true" />
                </span>
              </div>
              <strong className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                {presentCount}
              </strong>
              <p className="text-[11px] text-muted-foreground">Marked present</p>
            </article>

            <article className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Absent
                </span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <IconCircleX size={16} aria-hidden="true" />
                </span>
              </div>
              <strong className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400 sm:text-3xl">
                {absentCount}
              </strong>
              <p className="text-[11px] text-muted-foreground">Absentees</p>
            </article>

            <article className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Turnout Rate
                </span>
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconTrendingUp size={16} aria-hidden="true" />
                </span>
              </div>
              <strong className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
                {attendanceRate}%
              </strong>
              <p className="text-[11px] text-muted-foreground">Session turnout</p>
            </article>
          </section>

          {/* Error & Success Messages */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            >
              <IconCircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{message}</span>
            </div>
          )}

          {/* ── 4. Student Roll Call & Roster Card ── */}
          <section className="rounded-xl border border-border/80 bg-card shadow-xs">
            {/* Header with Title, Search, Status Tabs & Batch Actions */}
            <div className="flex flex-col gap-3.5 border-b border-border/70 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-foreground">Student Roll Call</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedClass ? `${selectedClass.subject.code}: ${selectedClass.subject.name}` : "Select a class"}
                  </p>
                </div>

                {/* Status Filter Tabs (All / Present / Absent) */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/60 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      statusFilter === "ALL"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({totalStudents})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("PRESENT")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      statusFilter === "PRESENT"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                    }`}
                  >
                    Present ({presentCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ABSENT")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      statusFilter === "ABSENT"
                        ? "bg-rose-600 text-white shadow-2xs"
                        : "text-rose-600 dark:text-rose-400 hover:text-rose-700"
                    }`}
                  >
                    Absent ({absentCount})
                  </button>
                </div>
              </div>

              {/* Search & Batch Tools */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative w-full sm:w-72">
                  <IconSearch className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    placeholder="Search student by name or roll..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    disabled={!selectedClass || totalStudents === 0 || isLocked || sessionStatus === "submitted"}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <IconCircleCheck size={14} className="text-emerald-600" aria-hidden="true" />
                    Mark All Present
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={invertSelection}
                    disabled={!selectedClass || totalStudents === 0 || isLocked || sessionStatus === "submitted"}
                    className="h-8 gap-1.5 text-xs font-semibold"
                    title="Invert present/absent selections"
                  >
                    <IconArrowsShuffle size={14} aria-hidden="true" />
                    Invert
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    disabled={!selectedClass || totalStudents === 0 || isLocked || sessionStatus === "submitted"}
                    className="h-8 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <IconCircleX size={14} aria-hidden="true" />
                    Clear All
                  </Button>
                </div>
              </div>
            </div>

            {/* Student Roll Rows */}
            {isLoading ? (
              <div className="grid gap-2.5 p-4 sm:p-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="flex flex-row items-stretch overflow-hidden rounded-xl border border-border/60 bg-card min-h-[4.5rem]"
                  >
                    <Skeleton className="w-16 sm:w-20 shrink-0 rounded-none border-r border-border/60" />
                    <div className="flex flex-1 flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-4 sm:py-3 gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Skeleton className="size-11 rounded-xl shrink-0" />
                        <div className="space-y-1.5 min-w-0">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-32 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !selectedClass || totalStudents === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-14 text-center">
                <IconUsers className="size-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">No students in this class program</p>
                <p className="text-xs text-muted-foreground">Select another program or semester above.</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-14 text-center">
                <IconSearch className="size-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">No matching students</p>
                <p className="text-xs text-muted-foreground">Try clearing your search query or status filter.</p>
              </div>
            ) : (
              <div className="grid gap-2.5 p-4 sm:p-5">
                {filteredStudents.map((student) => {
                  const isPresent = presentStudentIds.has(student.id);
                  const inactive = isAccountInactive(student);
                  const readOnly = inactive || isLocked || sessionStatus === "submitted";
                  const studentAttendanceRate =
                    student.attendance.total > 0
                      ? Math.round((student.attendance.present / student.attendance.total) * 100)
                      : 100;

                  return (
                    <div
                      key={student.id}
                      role="button"
                      tabIndex={readOnly ? -1 : 0}
                      aria-pressed={isPresent}
                      onClick={() => {
                        if (readOnly) return;
                        toggleStudent(student.id);
                      }}
                      onKeyDown={(e) => {
                        if (readOnly) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleStudent(student.id);
                        }
                      }}
                      className={`group flex flex-row items-stretch overflow-hidden rounded-xl border transition-all min-h-[4.5rem] sm:min-h-[4.75rem] ${
                        isPresent
                          ? "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10"
                          : "border-border/70 bg-card hover:border-border hover:bg-muted/15"
                      } ${inactive ? "opacity-60" : ""} ${readOnly ? "" : "cursor-pointer hover:shadow-2xs"}`}
                    >
                      {/* Left: Flush Tiling Roll Number Gutter */}
                      <div
                        className={`flex w-16 sm:w-20 shrink-0 self-stretch items-center justify-center border-r font-mono text-2xl sm:text-3xl font-black tabular-nums transition-colors select-none ${
                          isPresent
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "border-border/70 bg-muted/60 text-foreground"
                        }`}
                      >
                        {student.rollNumber != null ? String(student.rollNumber).padStart(2, "0") : "—"}
                      </div>

                      {/* Main Body: Avatar, Info, Progress & Action Controls */}
                      <div className="flex flex-1 flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3 min-w-0">
                        {/* Student Avatar & Identity */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Avatar className="size-11 rounded-xl shrink-0">
                            {student.profileImageUrl ? (
                              <AvatarImage src={student.profileImageUrl} alt="" className="object-cover" />
                            ) : null}
                            <AvatarFallback className="rounded-xl text-xs sm:text-sm font-bold">
                              {student.user.firstName[0]}
                              {student.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm sm:text-base text-foreground truncate">
                                {student.user.firstName} {student.user.lastName}
                              </span>
                              {inactive && (
                                <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="font-mono">{student.enrollmentNumber}</span>
                              <span className="lg:hidden font-medium">
                                · {student.attendance.present}/{student.attendance.total} ({studentAttendanceRate}%)
                              </span>
                              {studentAttendanceRate < 75 && (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                                  · At-Risk (&lt;75%)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Cumulative Attendance Meter + Dual [P] / [A] Action Buttons */}
                        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                          {/* Subject Attendance Meter */}
                          <div className="hidden lg:flex items-center shrink-0">
                            <AttendanceMeter
                              present={student.attendance.present}
                              total={student.attendance.total}
                            />
                          </div>

                          {/* Dual Toggle Pill Buttons */}
                          <div
                            className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/60"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => markStudentPresent(student.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isPresent
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                              } ${readOnly ? "cursor-not-allowed opacity-70" : ""}`}
                            >
                              <IconCircleCheck size={15} />
                              <span>Present</span>
                            </button>

                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => markStudentAbsent(student.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                !isPresent && !inactive
                                  ? "bg-rose-600 text-white shadow-xs"
                                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                              } ${readOnly ? "cursor-not-allowed opacity-70" : ""}`}
                            >
                              <IconCircleX size={15} />
                              <span>Absent</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 5. Sticky Floating Action & Submit Bar ── */}
          <div className="sticky bottom-4 z-20 mx-auto w-full rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md p-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left: Live Summary & Edit Window Countdown */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    {presentCount} <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">Present</span>
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-bold text-sm text-foreground">
                    {absentCount} <span className="text-rose-600 dark:text-rose-400 font-semibold text-xs">Absent</span>
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-semibold text-muted-foreground">
                    {attendanceRate}% Turnout
                  </span>
                </div>

                {!isLocked && sessionStatus !== "idle" && editWindowEndsAt && remainingLabel && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 gap-1 text-[11px] font-semibold py-0.5"
                  >
                    <IconClock size={12} />
                    Editable for {remainingLabel}
                  </Badge>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2.5 self-end sm:self-center">
                {sessionStatus === "idle" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    disabled={!selectedClass || totalStudents === 0}
                    className="text-xs h-9 font-semibold hidden sm:inline-flex"
                  >
                    Mark All Present
                  </Button>
                )}

                <Button
                  type="button"
                  variant={isLocked ? "secondary" : "default"}
                  size="sm"
                  className="h-9 px-5 text-xs font-bold gap-1.5 shadow-sm"
                  onClick={() => {
                    if (sessionStatus === "submitted" && !isLocked) {
                      setSessionStatus("editing");
                      setMessage("");
                      return;
                    }
                    void submitAttendance();
                  }}
                  disabled={!selectedClass || isSubmitting || totalStudents === 0 || isLocked}
                >
                  {isLocked ? (
                    <>
                      <IconLock size={15} />
                      Locked
                      {submittedAt
                        ? ` · Saved ${new Date(submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </>
                  ) : sessionStatus === "editing" ? (
                    isSubmitting ? "Updating Session…" : "Update Attendance"
                  ) : sessionStatus === "submitted" ? (
                    <>
                      <IconPencil size={15} />
                      Edit Attendance
                    </>
                  ) : isSubmitting ? (
                    "Submitting Session…"
                  ) : (
                    <>
                      <IconCircleCheck size={16} />
                      Save Attendance ({presentCount} Present)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-6">
          <TeacherAttendanceRecords />
        </TabsContent>
      </Tabs>
    </TeacherShell>
  );
}
