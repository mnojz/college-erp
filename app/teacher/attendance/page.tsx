"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  IconCalendarEvent,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconFilterOff,
  IconLoader2,
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

  // Campus wall-clock, never the browser's timezone: class times are stored as
  // wall-clock, so a machine set to another zone would otherwise resolve the
  // wrong day and the wrong "current" class.
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
  // Campus date, not UTC: between 00:00 and the UTC offset, toISOString()
  // hands back YESTERDAY and attendance gets filed under it.
  const todayISO = campusTodayISO();
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

  /** One dropdown entry per SUBJECT -- weekday/time never appear here. Those only
   *  power the smart suggestion; the concrete slot is resolved automatically
   *  (today's schedule, else first weekly slot) when recording. A subject is a
   *  single entry whether it runs as a Lecture, a Practical, or both.
   */
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

  /** If the currently selected class is filtered out, fall back to the routine-suggested
   *  class. Implemented as a helper called from the filter event handlers (not an effect,
   *  to avoid synchronous setState-in-effect lint rules.).
   */
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
        // Smart-default: find the class currently in session (by day + time),
        // falling back to the first class in sorted order.
        const initialClassId = findCurrentClassId(loadedClasses) || "";
        setSelectedClassId(initialClassId);
        // Hydrate attendance already saved for that class TODAY, so returning to
        // this page (or refreshing it) restores the marks, the 5-minute
        // countdown and the "Edit Attendance" button instead of a blank form.
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
      }
    }

    loadData();
    // loadExistingSession is re-created on every render, so it cannot be a
    // dependency: this effect must hydrate exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Keep the client clock fresh while a session is submitted (and not yet
  // locked) so the edit-window countdown and the "Locked" flip happen live.
  // The first sync runs in a timeout (not the effect body) to satisfy the
  // set-state-in-effect rule; it still fires within milliseconds.
  useEffect(() => {
    if (!submittedAt || isLocked) return;
    const sync = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(sync);
      clearInterval(timer);
    };
  }, [submittedAt, isLocked]);

  /**
   * Baseline of the last SAVED marks for the current class. An edit (PUT)
   * only needs the PRESENT delta against this set — today's session is
   * already counted in the roster meters — so no refetch is required.
   */
  const savedMarksRef = useRef<Set<string>>(new Set());

  /**
   * Adjusts one class's per-student meters in place so the bars refresh the
   * moment attendance saves. `deltaFor` supplies the present/total increments
   * (or decrements) for each student.
   */
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
    // Deactivated accounts are read-only on the roll (the server rejects them too).
    const target = selectedClass?.program.students.find((s) => s.id === studentId);
    if (target && isAccountInactive(target)) return;
    setPresentStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function selectClass(classId: string) {
    setSelectedClassId(classId);
    setMessage("");
    setError("");
    // Restores any attendance already saved today for this class (including
    // its locked/editable state) so switching classes never loses state.
    void loadExistingSession(classId);
  }

  /**
   * Picks a SUBJECT from the dropdown and resolves the concrete class slot to
   * record against: the slot scheduled right now for that subject, else its
   * first weekly slot. Day/time never appear in the dropdown itself.
   */
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

  /** Loads any attendance already saved today for this class so the UI can
   *  restore its submitted/locked state (server decides editability). */
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
        // Drop any PRESENT record belonging to a since-deactivated account so it
        // can never come back pre-checked.
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
        // Remember the server's marks as the baseline for the next edit's
        // meter delta (a PUT shifts PRESENT counts, never session totals).
        savedMarksRef.current = marks;
      } else {
        resetToIdle();
      }
    } catch {
      /* A failed pre-fetch is non-fatal - the roster still renders empty. */
      resetToIdle();
    }
  }

  /** Submit (first save) or update (edit) today's session for the selected class. */
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
          // Always today — attendance cannot be recorded in advance or retroactively.
          sessionDate: todayISO,
          presentStudentIds: [...presentStudentIds],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to submit attendance");
        // Someone already saved this session (or the window closed): rebuild the
        // whole UI from the server so the saved marks AND the countdown come
        // back, instead of just flipping the button label.
        if (result.session || result.locked) {
          await loadExistingSession(selectedClass.id);
        }
        return;
      }
      setSubmittedAt(result.session?.createdAt ?? new Date().toISOString());
      setSessionStatus("submitted");
      // Refresh this class's meters locally so the bars move with the save:
      // a first save adds one session for the whole roster (+1 present for
      // each mark); an edit only shifts the PRESENT delta, because today's
      // session was already counted when the sheet was first saved.
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

  // Sort by roll number, then filter. The API orders students the same way,
  // but re-sorting here guarantees roll call stays in roll order regardless
  // of what any endpoint returns: null rolls sort last (matching the API's
  // `nulls: "last"`), enrollment number breaks ties.
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
    const roster = selectedClass.program.students;
    if (!searchQuery.trim()) return [...roster].sort(byRoll);
    const q = searchQuery.toLowerCase();
    return roster
      .filter(
        (s) =>
          s.user.firstName.toLowerCase().includes(q) ||
          s.user.lastName.toLowerCase().includes(q) ||
          s.enrollmentNumber.toLowerCase().includes(q) ||
          (s.rollNumber != null && String(s.rollNumber).includes(q)),
      )
      .sort(byRoll);
  }, [selectedClass, searchQuery]);

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
          {/* Attendance Control Card */}
          <section className="rounded-xl border bg-card shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconCalendarEvent size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Select a Class</h2>
                  <p className="text-xs text-muted-foreground">
                    Filter by program and semester, then choose the class for today&apos;s roll call.
                  </p>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-primary"
                title="Attendance is recorded for today only — there is no date picker by design"
              >
                <IconCalendarEvent size={15} aria-hidden="true" />
                Today · {todayLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 items-end gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[0.9fr_0.9fr_1.7fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="att-filter-program">Program</Label>
            <Select
              value={selectedProgram}
              onValueChange={handleProgramChange}
              disabled={isLoading || availablePrograms.length === 0}
            >
              <SelectTrigger id="att-filter-program" className="w-full">
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
            <Label htmlFor="att-filter-semester">Semester</Label>
            <Select
              value={selectedSemester}
              onValueChange={handleSemesterChange}
              disabled={isLoading || availableSemesters.length === 0}
            >
              <SelectTrigger id="att-filter-semester" className="w-full">
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
            <Label htmlFor="att-filter-subject">Class / Subject</Label>
            <Select
              value={selectedSubjectKey || undefined}
              onValueChange={selectSubject}
              disabled={isLoading || filteredClasses.length === 0}
            >
              <SelectTrigger id="att-filter-subject" className="w-full">
                <SelectValue placeholder="No matching classes found" />
              </SelectTrigger>
              <SelectContent>
                {subjectOptions.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                    {opt.hasPractical ? " \u00b7 incl. practical" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={resetFilters}
            disabled={selectedProgram === "ALL" && selectedSemester === "ALL"}
            title="Reset the program and semester filters"
          >
            <IconFilterOff size={15} aria-hidden="true" />
            </Button>
            </div>
          </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Enrolled
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconUsers size={16} aria-hidden="true" />
            </span>
          </div>
          <strong className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {totalStudents}
          </strong>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Total in {selectedClass?.program.code ?? "class"}
          </p>
        </article>

        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Present
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-(--ctp-green)">
              <IconCircleCheck size={16} aria-hidden="true" />
            </span>
          </div>
          <strong className="mt-3 text-2xl font-bold tracking-tight text-(--ctp-green) sm:text-3xl">
            {presentCount}
          </strong>
          <p className="mt-0.5 text-xs text-muted-foreground">Marked present</p>
        </article>

        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Absent
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <IconCircleX size={16} aria-hidden="true" />
            </span>
          </div>
          <strong className="mt-3 text-2xl font-bold tracking-tight text-destructive sm:text-3xl">
            {absentCount}
          </strong>
          <p className="mt-0.5 text-xs text-muted-foreground">Absentee students</p>
        </article>

        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Rate
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconTrendingUp size={16} aria-hidden="true" />
            </span>
          </div>
          <strong className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {attendanceRate}%
          </strong>
          <p className="mt-0.5 text-xs text-muted-foreground">Current session</p>
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
          className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_oklab,var(--ctp-green)_30%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_12%,transparent)] px-4 py-3 text-sm font-medium text-(--ctp-green)"
        >
          <IconCircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      {/* Roster & Roll Call Card */}
      <section className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border/70 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Student Roll Call</h2>
            <p className="text-xs text-muted-foreground">
              {selectedClass ? `${selectedClass.subject.code}: ${selectedClass.subject.name}` : "Select a class"}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <IconSearch className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search student or roll..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={!selectedClass || totalStudents === 0 || isLocked || sessionStatus === "submitted"}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <IconCircleCheck size={15} aria-hidden="true" />
                Mark All Present
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={!selectedClass || totalStudents === 0 || isLocked || sessionStatus === "submitted"}
                className="h-9 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <IconCircleX size={15} aria-hidden="true" />
                Clear All
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <IconLoader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Loading student roster…</p>
          </div>
        ) : !selectedClass || totalStudents === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-16 text-center">
            <IconUsers className="size-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No enrolled students in this class program yet.
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-16 text-center">
            <IconSearch className="size-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No students matching &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <div className="grid gap-2 p-5">
            {filteredStudents.map((student) => {
              const isPresent = presentStudentIds.has(student.id);
              // Deactivated account: still listed on the roll, never markable.
              const inactive = isAccountInactive(student);
              // Marks lock as soon as the sheet is submitted. They only unlock
              // again after "Edit Attendance" flips the session back to "editing",
              // so a saved sheet can never be silently changed by a stray click.
              const readOnly = inactive || isLocked || sessionStatus === "submitted";
              return (
                <div
                  key={student.id}
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-pressed={isPresent}
                  onClick={() => {
                    // Locked sessions and deactivated accounts are both read-only;
                    // the server rejects edits to either.
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
                  className={`flex min-h-16 items-stretch justify-between gap-4 overflow-hidden rounded-xl border transition-colors ${
                    isPresent
                      ? "border-[color-mix(in_oklab,var(--ctp-green)_35%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_8%,transparent)]"
                      : "border-border bg-card"
                  } ${inactive ? "opacity-50" : ""} ${readOnly ? "" : "cursor-pointer hover:bg-muted/40"}`}
                >
                  {/* Left group stretches to the row's full height so the roll
                      tile reads as a flush-left gutter: no padding around it,
                      square right edge, left corners inherited from the row's
                      rounded-xl + overflow-hidden clipping. */}
                  <div className="flex min-w-0 items-stretch gap-3.5">
                    {/* Roll number leads the row — teachers mark attendance by
                        roll, so it's the primary scan target. Zero-padded so
                        digits stay aligned down the list; the present state is
                        carried by the green tint + checkbox, not a badge. */}
                    <span
                      className={`flex w-16 shrink-0 items-center justify-center border-r text-2xl font-extrabold tabular-nums ${
                        isPresent
                          ? "border-[color-mix(in_oklab,var(--ctp-green)_30%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_16%,transparent)] text-(--ctp-green)"
                          : "border-border bg-muted text-foreground"
                      }`}
                    >
                      {student.rollNumber != null
                        ? String(student.rollNumber).padStart(2, "0")
                        : "—"}
                    </span>
                    <div className="flex min-w-0 items-center">
                      {/* Profile photo when one is set, tinted initials as the
                          fallback — same rounded-lg avatar as the records
                          table. The after: override squares the component's
                          hairline ring to the box. */}
                      <Avatar className="size-10 rounded-lg after:rounded-lg">
                        {student.profileImageUrl ? (
                          // Decorative: the student's name sits right next to
                          // the avatar, so a duplicate alt would only add
                          // screen-reader noise.
                          <AvatarImage
                            src={student.profileImageUrl}
                            alt=""
                            className="rounded-lg object-cover"
                          />
                        ) : null}
                        <AvatarFallback
                          className={`rounded-lg text-sm font-bold ${
                            isPresent
                              ? "bg-[color-mix(in_oklab,var(--ctp-green)_16%,transparent)] text-(--ctp-green)"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {student.user.firstName[0]}
                          {student.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <p className="ml-3.5 min-w-0 truncate text-sm font-semibold text-foreground">
                        {student.user.firstName} {student.user.lastName}
                      </p>
                    </div>
                  </div>

                  {/* Right cluster: the fixed-width meter sits close to the
                      checkbox (shared gap) so every row's bar has the same
                      length — the name absorbs the remaining slack. */}
                  <div className="flex shrink-0 items-center gap-30 pr-6">
                    <AttendanceMeter
                      present={student.attendance.present}
                      total={student.attendance.total}
                    />
                    {inactive && (
                      <span
                        className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground"
                        title="This student's account was deactivated by an admin — they cannot be marked present"
                      >
                        INACTIVE
                      </span>
                    )}
                    <Checkbox
                      checked={isPresent}
                      disabled={readOnly}
                      onCheckedChange={() => toggleStudent(student.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Mark ${student.user.firstName} ${student.user.lastName} ${isPresent ? "absent" : "present"}`}
                      // Bigger box (28px) with the app's rounded-lg radius.
                      // The `!` flags outrank data-checked:bg-primary AND
                      // dark:data-checked:bg-primary — the class merger keeps
                      // that one because its modifiers differ — so a checked
                      // box is always catppuccin green, never the default blue.
                      // The indicator's built-in icon size ([&>svg]:size-3.5)
                      // has equal specificity to a plain [&_svg] override, so
                      // the winner would depend on stylesheet order. Target the
                      // indicator explicitly to keep the 20px checkmark.
                      className="size-7! cursor-pointer rounded-lg! data-checked:border-(--ctp-green)! data-checked:bg-(--ctp-green)! [&_[data-slot=checkbox-indicator]>svg]:size-5"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 p-5">
          <span className="text-xs text-muted-foreground">
            Unchecked students are marked Absent automatically.
            {!isLocked && sessionStatus !== "idle" && editWindowEndsAt && remainingLabel && (
              <>
                {" "}· Editable for <strong className="font-semibold text-foreground">{remainingLabel}</strong> remaining (until{" "}
                <strong className="font-semibold text-foreground">
                  {editWindowEndsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </strong>
                )
              </>
            )}
          </span>
          <Button
            type="button"
            variant={isLocked ? "secondary" : "default"}
            size="lg"
            className="gap-2 px-6 font-semibold shadow-sm"
            onClick={() => {
              // First press after a submission switches into edit mode; the
              // next press actually updates the session on the server.
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
                <IconLock size={16} aria-hidden="true" />
                Locked
                {submittedAt
                  ? ` · Saved ${new Date(submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </>
            ) : sessionStatus === "editing" ? (
              isSubmitting ? "Updating Session…" : "Update Attendance"
            ) : sessionStatus === "submitted" ? (
              <>
                <IconPencil size={16} aria-hidden="true" />
                Edit Attendance
              </>
            ) : isSubmitting ? (
              "Submitting Session…"
            ) : (
              `Save Attendance (${presentCount} Present)`
            )}
          </Button>
        </div>
      </section>
        </TabsContent>

        <TabsContent value="records" className="space-y-6">
          <TeacherAttendanceRecords />
        </TabsContent>
      </Tabs>
    </TeacherShell>
  );
}
