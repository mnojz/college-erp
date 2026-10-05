"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconCalendarEvent,
  IconFilterOff,
  IconLock,
  IconPencil,
} from "@tabler/icons-react";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";

type Student = {
  id: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  /** `user.status` — INACTIVE means an admin deactivated this account. */
  user: { firstName: string; lastName: string; status: string };
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

/** Map of DayOfWeek enum values to numeric order for day-of-week matching. */
const DAY_ORDER: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
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

  const now = new Date();
  // getNextBusinessDay: JS getDay() returns 0=Sun..6=Sat; our enum uses MONDAY=1..SUNDAY=7
  const jsDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const todayKey = Object.keys(DAY_ORDER).find(
    (k) => DAY_ORDER[k] === (jsDay === 0 ? 7 : jsDay),
  );
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

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

  /** Attendance is always for the current day — shown as read-only info. */
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString("en-GB", {
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
        setPresentStudentIds(
          new Set(
            (data.session.records ?? [])
              .filter((r: { status: string }) => r.status === "PRESENT")
              .map((r: { studentId: string }) => r.studentId)
              .filter((studentId: string) => !inactiveIds.has(studentId)),
          ),
        );
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

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    if (!searchQuery.trim()) return selectedClass.program.students;
    const q = searchQuery.toLowerCase();
    return selectedClass.program.students.filter(
      (s) =>
        s.user.firstName.toLowerCase().includes(q) ||
        s.user.lastName.toLowerCase().includes(q) ||
        s.enrollmentNumber.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q)),
    );
  }, [selectedClass, searchQuery]);

  return (
    <TeacherShell
      active="/teacher/attendance"
      title="Class Attendance Management"
      subtitle="Roll Call & Attendance Logs"
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Faculty Member"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      {/* Attendance Control Card */}
      <section className="rounded-xl border bg-card p-5 shadow-xs" style={{ padding: "22px", marginBottom: "20px" }}>
        {/* Filter bar: Program → Semester → Class → Clear. The JSX source order
            is kept, so each column sets a CSS grid `order` for visual order. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr 1.7fr auto",
            gap: "16px",
            alignItems: "end",
            marginBottom: "12px",
          }}
        >
          <div style={{ order: 3 }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
              Select Class / Subject
            </label>
            <select
              value={selectedSubjectKey}
              onChange={(e) => selectSubject(e.target.value)}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "inherit",
              }}
            >
              {filteredClasses.length === 0 && <option value="">No matching classes found</option>}
              {filteredClasses.length > 0 && (() => {
                // One option per SUBJECT — weekday/time never appear here.
                // Those only power the smart suggestion; the concrete slot is
                // resolved automatically (today's schedule, else first weekly
                // slot) when recording. A subject is a single entry whether it
                // runs as a Lecture, a Practical, or both.
                const subjects = new Map<
                  string,
                  { key: string; label: string; hasPractical: boolean }
                >();
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
                return Array.from(subjects.values()).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                    {s.hasPractical ? " · incl. practical" : ""}
                  </option>
                ));
              })()}
            </select>
          </div>

          <div style={{ order: 1 }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
              Program
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => handleProgramChange(e.target.value)}
              disabled={isLoading || availablePrograms.length === 0}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "inherit",
              }}
            >
              <option value="ALL">All Programs</option>
              {availablePrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ order: 2 }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => handleSemesterChange(e.target.value)}
              disabled={isLoading || availableSemesters.length === 0}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "inherit",
              }}
            >
              <option value="ALL">All Semesters</option>
              {availableSemesters.map((s) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ order: 4 }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.8rem",
                visibility: "hidden",
              }}
            >
              Clear
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              disabled={selectedProgram === "ALL" && selectedSemester === "ALL"}
              title="Reset the program and semester filters"
              className="w-full"
              style={{
                height: "auto",
                padding: "10px 14px",
                fontSize: "0.85rem",
                borderRadius: "8px",
              }}
            >
              <IconFilterOff size={14} />
              Clear Filters
            </Button>
          </div>
        </div>
        {/* Date is read-only info — attendance can only ever be taken today. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            borderTop: "1px solid var(--border)",
            paddingTop: "12px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "7px 12px",
              borderRadius: "8px",
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--primary)",
            }}
            title="Attendance is recorded for today only — there is no date picker by design"
          >
            <IconCalendarEvent size={15} />
            Today · {todayLabel}
          </span>

        </div>
      </section>

      {/* Metrics Row */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" style={{ marginBottom: "20px" }}>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Enrolled Students</span>
          <strong>{totalStudents}</strong>
          <small>Total in {selectedClass?.program.code ?? "class"}</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Marked Present</span>
          <strong className="text-emerald-600 dark:text-emerald-400">{presentCount}</strong>
          <small>In-person attendance</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Marked Absent</span>
          <strong className="text-red-600 dark:text-red-400">{absentCount}</strong>
          <small>Absentee students</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Attendance Rate</span>
          <strong style={{ color: "var(--accent)" }}>{attendanceRate}%</strong>
          <small>Current session</small>
        </article>
      </section>

      {/* Error & Success Messages */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
            color: "var(--destructive)",
            border: "1px solid color-mix(in srgb, var(--destructive) 25%, transparent)",
            marginBottom: "16px",
            fontSize: "0.88rem",
          }}
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "color-mix(in srgb, #10b981 14%, transparent)",
            color: "#059669",
            border: "1px solid color-mix(in srgb, #10b981 30%, transparent)",
            marginBottom: "16px",
            fontSize: "0.88rem",
          }}
          role="status"
        >
          {message}
        </div>
      )}

      {/* Roster & Roll Call Card */}
      <section className="rounded-xl border bg-card p-5 shadow-xs" style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, padding: 0, fontSize: "1.15rem", fontWeight: "700" }}>
              Student Roll Call Checklist
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
              {selectedClass ? `${selectedClass.subject.code}: ${selectedClass.subject.name}` : "Select a class"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="search"
              placeholder="Search student or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "200px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                fontSize: "0.82rem",
                background: "var(--card)",
                color: "inherit",
              }}
            />
            <Button
              type="button"
              onClick={selectAll}
              disabled={!selectedClass || totalStudents === 0 || isLocked}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "inherit",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Mark All Present
            </Button>
            <Button
              type="button"
              onClick={clearAll}
              disabled={!selectedClass || totalStudents === 0 || isLocked}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "inherit",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Clear All
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground" style={{ textAlign: "center", padding: "40px 0" }}>
            Loading student roster...
          </p>
        ) : !selectedClass || totalStudents === 0 ? (
          <p className="text-center text-sm text-muted-foreground" style={{ textAlign: "center", padding: "40px 0" }}>
            No enrolled students in this class program yet.
          </p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground" style={{ textAlign: "center", padding: "40px 0" }}>
            No students matching &quot;{searchQuery}&quot;
          </p>
        ) : (
          <div style={{ display: "grid", gap: "8px", marginTop: "16px" }}>
            {filteredStudents.map((student) => {
              const isPresent = presentStudentIds.has(student.id);
              // Deactivated account: still listed on the roll, never markable.
              const inactive = isAccountInactive(student);
              const readOnly = inactive || isLocked;
              return (
                <div
                  key={student.id}
                  onClick={() => {
                    // Locked sessions and deactivated accounts are both read-only;
                    // the server rejects edits to either.
                    if (readOnly) return;
                    toggleStudent(student.id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: `1px solid ${isPresent ? "color-mix(in oklab, var(--ctp-green) 35%, transparent)" : "var(--border)"}`,
                    background: isPresent ? "color-mix(in oklab, var(--ctp-green) 10%, transparent)" : "var(--card)",
                    // Greyed out while the account is deactivated.
                    opacity: inactive ? 0.5 : 1,
                    cursor: readOnly ? "default" : "pointer",
                    transition: "all 120ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        background: isPresent ? "color-mix(in oklab, var(--ctp-green) 16%, transparent)" : "var(--muted)",
                        color: isPresent ? "var(--ctp-green)" : "var(--muted-foreground)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.85rem",
                        fontWeight: "700",
                      }}
                    >
                      {student.user.firstName[0]}
                      {student.user.lastName[0]}
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.92rem" }}>
                        {student.user.firstName} {student.user.lastName}
                      </strong>
                      <span style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>
                        Roll: {student.rollNumber || "N/A"} · Enrollment: {student.enrollmentNumber}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${
                        isPresent
                          ? "border-[color-mix(in_oklab,var(--ctp-green)_35%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-[var(--ctp-green)]"
                          : "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/20"
                      }`}
                    >
                      {isPresent ? "PRESENT" : "ABSENT"}
                    </span>
                    {inactive && (
                      <span
                        className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground"
                        title="This student's account was deactivated by an admin - they cannot be marked present"
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
                      className="size-5 cursor-pointer rounded-[6px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Bar */}
        <div
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "0.82rem", color: "var(--muted-foreground)" }}>
            Unchecked students are marked Absent automatically.
            {!isLocked && sessionStatus !== "idle" && editWindowEndsAt && remainingLabel && (
              <>
                {" "}· Editable for <strong>{remainingLabel}</strong> remaining (until{" "}
                <strong>
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
            className="px-6 font-semibold"
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
                <IconLock size={15} />
                Locked
                {submittedAt
                  ? ` · Saved ${new Date(submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </>
            ) : sessionStatus === "editing" ? (
              isSubmitting ? "Updating Session..." : "Update Attendance"
            ) : sessionStatus === "submitted" ? (
              <>
                <IconPencil size={15} />
                Edit Attendance
              </>
            ) : isSubmitting ? (
              "Submitting Session..."
            ) : (
              `Save Attendance (${presentCount} Present)`
            )}
          </Button>
        </div>
      </section>
    </TeacherShell>
  );
}
