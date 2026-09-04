"use client";

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
  user: { firstName: string; lastName: string };
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

/** Get the base subject code without the practical group suffix (e.g. "EX 365-P" → "EX 365"). */
/** Get the base subject code without the practical group suffix (e.g. "EX 365-P" → "EX 365"). */
function baseSubjectCode(code: string): string {
  return code.replace(/-P$/, "");
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

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId],
  );

  /** Dropdown value: the distinct-subject key the selected class belongs to. */
  const selectedSubjectKey = selectedClass
    ? `${selectedClass.program.id}|${selectedClass.semester}|${baseSubjectCode(selectedClass.subject.code)}`
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

        setClasses(attResult.classes ?? []);
        // Smart-default: find the class currently in session (by day + time),
        // falling back to the first class in sorted order.
        setSelectedClassId(findCurrentClassId(attResult.classes ?? []) || "");

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
        baseSubjectCode(c.subject.code) === base,
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
    setPresentStudentIds(new Set(selectedClass.program.students.map((s) => s.id)));
  }

  function clearAll() {
    setPresentStudentIds(new Set());
  }

  /** Loads any attendance already saved today for this class so the UI can
   *  restore its submitted/locked state (server decides editability). */
  async function loadExistingSession(classId: string) {
    setSessionStatus("idle");
    setSubmittedAt(null);
    setPresentStudentIds(new Set());
    if (!classId) return;
    try {
      const res = await fetch(`/api/attendance?classId=${classId}&date=${todayISO}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        setSubmittedAt(data.session.createdAt ?? null);
        setSessionStatus("submitted");
        setPresentStudentIds(
          new Set(
            (data.session.records ?? [])
              .filter((r: { status: string }) => r.status === "PRESENT")
              .map((r: { studentId: string }) => r.studentId),
          ),
        );
      }
    } catch {
      /* A failed pre-fetch is non-fatal — the roster still renders empty. */
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
        // Someone already saved this session (or the window closed) — reflect it.
        if (result.session) {
          setSubmittedAt(result.session.createdAt ?? null);
          setSessionStatus("submitted");
        } else if (result.locked) {
          setSessionStatus("submitted");
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
      <section className="profile-info-card" style={{ padding: "22px", marginBottom: "20px" }}>
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
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
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
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "inherit",
              }}
            >
              {filteredClasses.length === 0 && <option value="">No matching classes found</option>}
              {filteredClasses.length > 0 && (() => {
                // One option per SUBJECT — weekday/time never appear here.
                // Those only power the smart suggestion; the concrete slot is
                // resolved automatically (today's schedule, else first weekly
                // slot) when recording. Practical variants (EX 365-P) collapse
                // into their parent subject (EX 365).
                const subjects = new Map<
                  string,
                  { key: string; label: string; hasPractical: boolean }
                >();
                for (const c of filteredClasses) {
                  const base = baseSubjectCode(c.subject.code);
                  const key = `${c.program.id}|${c.semester}|${base}`;
                  const existing = subjects.get(key);
                  if (existing) {
                    if (!existing.hasPractical && base !== c.subject.code) {
                      existing.hasPractical = true;
                    }
                    continue;
                  }
                  subjects.set(key, {
                    key,
                    label: `[${c.program.code} · Sem ${c.semester}] ${c.subject.name} (${base})`,
                    hasPractical: base !== c.subject.code,
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
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
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
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
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
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
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
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
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
            <button
              type="button"
              onClick={resetFilters}
              disabled={selectedProgram === "ALL" && selectedSemester === "ALL"}
              title="Reset the program and semester filters"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "var(--ink, #1e293b)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
            >
              <IconFilterOff size={14} />
              Clear Filters
            </button>
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
            borderTop: "1px solid var(--line, #e2e8f0)",
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
              background: "var(--info-soft)",
              border: "1px solid var(--info-border)",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--info-ink)",
            }}
            title="Attendance is recorded for today only — there is no date picker by design"
          >
            <IconCalendarEvent size={15} />
            Today · {todayLabel}
          </span>

        </div>
      </section>

      {/* Metrics Row */}
      <section className="admin-metric-grid" style={{ marginBottom: "20px" }}>
        <article className="admin-metric-card">
          <span>Enrolled Students</span>
          <strong>{totalStudents}</strong>
          <small>Total in {selectedClass?.program.code ?? "class"}</small>
        </article>
        <article className="admin-metric-card">
          <span>Marked Present</span>
          <strong style={{ color: "var(--ok)" }}>{presentCount}</strong>
          <small>In-person attendance</small>
        </article>
        <article className="admin-metric-card">
          <span>Marked Absent</span>
          <strong style={{ color: "var(--danger)" }}>{absentCount}</strong>
          <small>Absentee students</small>
        </article>
        <article className="admin-metric-card">
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
            background: "var(--danger-soft)",
            color: "var(--danger-ink)",
            border: "1px solid var(--danger-border)",
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
            background: "var(--ok-soft)",
            color: "var(--ok-ink)",
            border: "1px solid var(--ok-border)",
            marginBottom: "16px",
            fontSize: "0.88rem",
          }}
          role="status"
        >
          {message}
        </div>
      )}

      {/* Roster & Roll Call Card */}
      <section className="profile-info-card" style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, padding: 0, fontSize: "1.15rem", fontWeight: "700" }}>
              Student Roll Call Checklist
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
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
                border: "1px solid var(--line, #e2e8f0)",
                fontSize: "0.82rem",
                background: "var(--panel, #fff)",
                color: "inherit",
              }}
            />
            <button
              type="button"
              onClick={selectAll}
              disabled={!selectedClass || totalStudents === 0}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "inherit",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Mark All Present
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={!selectedClass || totalStudents === 0}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "inherit",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
            Loading student roster...
          </p>
        ) : !selectedClass || totalStudents === 0 ? (
          <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
            No enrolled students in this class program yet.
          </p>
        ) : filteredStudents.length === 0 ? (
          <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
            No students matching &quot;{searchQuery}&quot;
          </p>
        ) : (
          <div style={{ display: "grid", gap: "8px", marginTop: "16px" }}>
            {filteredStudents.map((student) => {
              const isPresent = presentStudentIds.has(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: `1px solid ${isPresent ? "var(--ok-border)" : "var(--line, #e2e8f0)"}`,
                    background: isPresent ? "var(--ok-faint)" : "var(--panel, #fff)",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        background: isPresent ? "var(--ok-soft)" : "var(--line-faint, #f1f5f9)",
                        color: isPresent ? "var(--ok-ink)" : "var(--ink-soft)",
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
                      <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                        Roll: {student.rollNumber || "N/A"} · Enrollment: {student.enrollmentNumber}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        background: isPresent ? "var(--ok-soft)" : "var(--danger-soft)",
                        color: isPresent ? "var(--ok-ink)" : "var(--danger-ink)",
                      }}
                    >
                      {isPresent ? "PRESENT" : "ABSENT"}
                    </span>
                    <input
                      type="checkbox"
                      checked={isPresent}
                      onChange={() => toggleStudent(student.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "18px",
                        height: "18px",
                        cursor: "pointer",
                        accentColor: "var(--accent)",
                      }}
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
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            Unchecked students are marked Absent automatically.
            {sessionStatus !== "idle" && !isLocked && editWindowEndsAt && (
              <>
                {" "}· Editable until{" "}
                <strong>{editWindowEndsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
              </>
            )}
          </span>
          <button
            className="primary-button"
            type="button"
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
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              background: isLocked ? "var(--line-strong)" : "var(--accent)",
              color: "#fff",
              fontWeight: "700",
              fontSize: "0.85rem",
              border: 0,
              cursor: isLocked ? "not-allowed" : "pointer",
              opacity: isLocked ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
            }}
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
          </button>
        </div>
      </section>
    </TeacherShell>
  );
}
