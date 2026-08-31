"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { TimetableGrid } from "@/app/components/timetable/TimetableGrid";
import { IconPlus, IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";

type ProgramOption = { id: string; name: string; code: string; durationYears: number };
type SubjectItem = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
  subjectTeachers: Array<{
    teacherId: string;
    teacher: { id: string; employeeNo: string; user: { firstName: string; lastName: string } };
  }>;
};
type TeacherOption = { id: string; name: string; employeeNo: string };
type ClassItem = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type?: string | null;
  group?: string | null;
  subjectId: string;
  teacherId: string | null;
  programId: string;
  semester: number;
  subject: { name: string; code: string };
  program: { name: string; code: string };
  teacher: { employeeNo: string; user: { firstName: string; lastName: string } } | null;
};
type CurriculumCourseRow = {
  key: string;
  courseId: string;
  code: string;
  name: string;
  semesterNo: number; // global semester number across the program
  programId: string;
};
type Block = ClassItem & { startMin: number; endMin: number; conflict: boolean };

// Full week on the timetable (Sat & Sun typically stay empty but keep the
// week visually complete).
const WORK_DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
// The lunch break is a regular class slot (type "Lunch", no teacher) stored in
// the classes table — one per program+semester. It is picked in the slot
// editor's Subject dropdown and rendered as the shaded Mon–Fri band.
const LUNCH_OPTION = "__lunch__";
const FALLBACK_START = 9 * 60;

const emptyClassForm = {
  subjectId: "",
  teacherId: "",
  dayOfWeek: "SUNDAY",
  startTime: "09:00",
  endTime: "10:30",
  type: "Lecture",
  group: "",
};

function formatTime(isoTime: string) {
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return isoTime;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return isoTime;
  }
}

function toMinutes(isoTime: string) {
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return null;
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  } catch {
    return null;
  }
}

function minutesToHHMM(totalMinutes: number) {
  const m = Math.max(0, Math.min(24 * 60 - 30, totalMinutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default function AdminTeachingPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Published curricula (source of truth for subjects)
  const [curricula, setCurricula] = useState<
    Array<{
      programId: string;
      years: Array<{
        semesters: Array<{
          courses: Array<{ id: string; code: string | null; name: string }>;
        }>;
      }>;
    }>
  >([]);

  // Scheduling context
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [editingClass, setEditingClass] = useState<{ id: string } & typeof emptyClassForm | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        const [pRes, sRes, cRes, tRes, curRes] = await Promise.all([
          fetch("/api/programs"),
          fetch("/api/subjects"),
          fetch("/api/classes"),
          fetch("/api/teachers"),
          fetch("/api/curriculum"),
        ]);
        const [pd, sd, cd, td, curd] = await Promise.all([
          pRes.json(),
          sRes.json(),
          cRes.json(),
          tRes.json(),
          curRes.json(),
        ]);
        const loadedPrograms: ProgramOption[] = pd.programs ?? [];
        setPrograms(loadedPrograms);
        setSubjects(sd.subjects ?? []);
        setClasses(cd.classes ?? []);
        setTeachers(
          (td.teachers ?? []).map(
            (x: { id: string; employeeNo: string; user: { firstName: string; lastName: string } }) => ({
              id: x.id,
              employeeNo: x.employeeNo,
              name: `${x.user.firstName} ${x.user.lastName}`,
            }),
          ),
        );
        setCurricula(curd.curricula ?? []);
        if (loadedPrograms.length > 0) setSelectedProgramId(loadedPrograms[0].id);
      } catch {
        setError("Unable to load scheduling records");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // ─── Derived: curriculum subjects for the selected program+semester ──
  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );
  const semesterCount = selectedProgram ? selectedProgram.durationYears * 2 : 0;

  const programCurriculum = useMemo(
    () => curricula.find((c) => c.programId === selectedProgramId) ?? null,
    [curricula, selectedProgramId],
  );

  // Flatten the published curriculum into per-course rows (with global
  // semester numbers) for the selected program.
  const semesterCourses = useMemo<CurriculumCourseRow[]>(() => {
    if (!programCurriculum) return [];
    const rows: CurriculumCourseRow[] = [];
    let semesterNo = 0;
    for (const year of programCurriculum.years) {
      for (const sem of year.semesters) {
        semesterNo += 1;
        for (const course of sem.courses) {
          if (!course.code || semesterNo !== Number(selectedSemester)) continue;
          rows.push({
            key: `${semesterNo}-${course.id}`,
            courseId: course.id,
            code: course.code,
            name: course.name,
            semesterNo,
            programId: selectedProgramId,
          });
        }
      }
    }
    return rows;
  }, [programCurriculum, selectedProgramId, selectedSemester]);

  // Resolve a curriculum course to its synced Subject row id.
  const resolveSubjectId = useCallback(
    (course: { code: string; semesterNo: number; programId: string }) =>
      subjects.find(
        (s) =>
          s.programId === course.programId &&
          s.semester === course.semesterNo &&
          s.code.toUpperCase() === course.code.toUpperCase(),
      )?.id ?? "",
    [subjects],
  );

  // ─── Derived: timetable blocks for the grid ─────────────────────────
  const scheduledBlocks = useMemo<Block[]>(() => {
    return classes
      .filter((c) => c.programId === selectedProgramId && c.semester === Number(selectedSemester))
      .map((c) => ({
        ...c,
        startMin: toMinutes(c.startTime) ?? FALLBACK_START,
        endMin: toMinutes(c.endTime) ?? FALLBACK_START + 90,
        conflict: false,
      }))
      .sort((a, b) => a.startMin - b.startMin);
  }, [classes, selectedProgramId, selectedSemester]);

  // Flag overlapping blocks. Rules:
  //  - Same teacher at the same time always conflicts.
  //  - Lecture + Lab (different slot types) may overlap.
  //  - Lecture + Lecture always conflicts.
  //  - Practical + Practical conflicts unless they are different parallel groups.
  const conflictedBlocks = useMemo(() => {
    const flagged = new Set<string>();
    for (let i = 0; i < scheduledBlocks.length; i += 1) {
      for (let j = i + 1; j < scheduledBlocks.length; j += 1) {
        const a = scheduledBlocks[i];
        const b = scheduledBlocks[j];
        if (a.dayOfWeek !== b.dayOfWeek) continue;
        const overlaps = a.startMin < b.endMin && a.endMin > b.startMin;
        if (!overlaps) continue;
        if (a.teacherId === b.teacherId) {
          flagged.add(a.id);
          flagged.add(b.id);
          continue;
        }
        // Different slot types (Lecture vs Practical/Lab) may overlap.
        const aType = a.type ?? "Lecture";
        const bType = b.type ?? "Lecture";
        if (aType !== bType) continue;
        // Same type — reject, except parallel practical groups (Gr. A/Gr. B).
        const differentGroups = !!a.group && !!b.group && a.group !== b.group;
        if (aType === "Practical" && differentGroups) continue;
        flagged.add(a.id);
        flagged.add(b.id);
      }
    }
    return flagged;
  }, [scheduledBlocks]);

  // Curriculum subjects of this semester that have no scheduled slot yet.
  const unscheduledSubjects = useMemo(() => {
    const scheduledSubjectIds = new Set(scheduledBlocks.map((b) => b.subjectId));
    return semesterCourses.filter((course) => {
      const subjectId = resolveSubjectId(course);
      return !subjectId || !scheduledSubjectIds.has(subjectId);
    });
  }, [semesterCourses, scheduledBlocks, resolveSubjectId]);

  // Subject options for the class modal (curriculum courses → synced ids)
  const classSubjectOptions = useMemo(
    () =>
      semesterCourses
        .map((course) => {
          const id = resolveSubjectId(course);
          return id ? { id, label: `${course.code} · ${course.name}` } : null;
        })
        .filter((x): x is { id: string; label: string } => x !== null),
    [semesterCourses, resolveSubjectId],
  );

  // Whether this table already has its single lunch-break slot, and whether
  // the open modal is currently scheduling/editing the lunch break.
  const lunchExists = classes.some(
    (c) =>
      c.programId === selectedProgramId &&
      c.semester === Number(selectedSemester) &&
      c.type === "Lunch",
  );
  const createIsLunch = classForm.subjectId === LUNCH_OPTION;
  const editIsLunch = editingClass?.type === "Lunch";

  // Same mapping, but for the slot being edited (may differ if the stored
  // subject no longer maps cleanly — keep its current value selectable).
  const editClassSubjectOptions = useMemo(() => {
    const options = [...classSubjectOptions];
    if (editingClass && !options.some((o) => o.id === editingClass.subjectId)) {
      const cls = classes.find((c) => c.id === editingClass.id);
      options.unshift({
        id: editingClass.subjectId,
        label: cls
          ? `${cls.subject.code} · ${cls.subject.name}`
          : "Current subject",
      });
    }
    return options;
  }, [classSubjectOptions, editingClass, classes]);

  // Teachers assigned to each subject (SubjectTeacher). Scheduling only ever
  // offers these teachers for a subject — the teacher is derived from the
  // subject assignment, never picked from the full faculty list.
  const teachersBySubject = useMemo(() => {
    const map = new Map<string, TeacherOption[]>();
    for (const subject of subjects) {
      const options = (subject.subjectTeachers ?? []).map((st) => ({
        id: st.teacher.id,
        name: `${st.teacher.user.firstName} ${st.teacher.user.lastName}`,
        employeeNo: st.teacher.employeeNo,
      }));
      map.set(subject.id, options);
    }
    return map;
  }, [subjects]);

  const assignedTeachersFor = (subjectId: string) => teachersBySubject.get(subjectId) ?? [];

  // ─── Handlers ────────────────────────────────────────────────────
  function openCreate(day?: string, startMin?: number) {
    const start = startMin ?? FALLBACK_START;
    setError("");
        setClassForm({
      subjectId: "",
      teacherId: "",
      dayOfWeek: day ?? WORK_DAYS[0],
      startTime: minutesToHHMM(start),
      endTime: minutesToHHMM(start + 90),
      type: "Lecture",
      group: "",
    });
    setShowClassModal(true);
  }

  function openEdit(block: Block) {
    setError("");
    if (block.type === "Lunch") {
      // The lunch break is edited as its own pseudo-subject in the editor.
      setEditingClass({
        id: block.id,
        subjectId: LUNCH_OPTION,
        teacherId: "",
        dayOfWeek: block.dayOfWeek,
        startTime: minutesToHHMM(toMinutes(block.startTime) ?? 0),
        endTime: minutesToHHMM(toMinutes(block.endTime) ?? 0),
        type: "Lunch",
        group: "",
      });
      return;
    }
    const subjectAssignments = assignedTeachersFor(block.subjectId);
    setEditingClass({
      id: block.id,
      subjectId: block.subjectId,
      // Keep the stored teacher when they're still assigned to this subject;
      // otherwise fall back to the subject's first assigned teacher.
      teacherId:
        block.teacherId && subjectAssignments.some((t) => t.id === block.teacherId)
          ? block.teacherId
          : (subjectAssignments[0]?.id ?? ""),
      dayOfWeek: block.dayOfWeek,
      startTime: minutesToHHMM(toMinutes(block.startTime) ?? 0),
      endTime: minutesToHHMM(toMinutes(block.endTime) ?? 0),
      type: block.type ?? "Lecture",
      group: block.group ?? "",
    });
  }

  async function refreshClasses() {
    const res = await fetch("/api/classes");
    const data = await res.json();
    setClasses(data.classes ?? []);
  }

  async function handleCreateClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProgramId || !selectedSemester) return;
    const isLunch = classForm.subjectId === LUNCH_OPTION;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: selectedProgramId,
          semester: Number(selectedSemester),
          subjectId: isLunch ? "" : classForm.subjectId,
          teacherId: isLunch ? "" : classForm.teacherId,
          dayOfWeek: classForm.dayOfWeek,
          startTime: classForm.startTime,
          endTime: classForm.endTime,
          type: isLunch ? "Lunch" : classForm.type,
          group: isLunch ? "" : classForm.group,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to schedule class");
        return;
      }
      await refreshClasses();
      setShowClassModal(false);
      setMessage("Class scheduled successfully.");
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClass) return;
    const isLunch = editingClass.type === "Lunch";
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingClass.id,
          programId: selectedProgramId,
          semester: Number(selectedSemester),
          subjectId: isLunch ? "" : editingClass.subjectId,
          teacherId: isLunch ? "" : editingClass.teacherId,
          dayOfWeek: editingClass.dayOfWeek,
          startTime: editingClass.startTime,
          endTime: editingClass.endTime,
          type: editingClass.type,
          group: editingClass.group,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update class slot");
        return;
      }
      await refreshClasses();
      setEditingClass(null);
      setMessage("Class updated successfully.");
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClass() {
    if (!deletingClass) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/classes?id=${deletingClass.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete class slot");
        return;
      }
      setClasses((prev) => prev.filter((c) => c.id !== deletingClass.id));
      setMessage("Class slot deleted successfully.");
      setDeletingClass(null);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  // Click an empty spot on a day row → open the "schedule class" dialog at that time.
  function handleTrackClick(day: string, minutes: number) {
    openCreate(day, minutes);
  }

  const teacherName = (id: string | null) =>
    (id && teachers.find((t) => t.id === id)?.name) || "Unknown";

  const ttInput: React.CSSProperties = {
    padding: "9px 12px",
    border: "1px solid var(--line)",
    borderRadius: "8px",
    background: "var(--input-bg)",
    color: "var(--input-color, inherit)",
    fontSize: "13px",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <AdminShell title="Class Scheduling" subtitle="Timetable Management" active="/admin/teaching">
      <div style={{ display: "grid", gap: "20px" }}>
        {/* Toolbar */}
        <section
          style={{
            padding: "18px 20px",
            borderRadius: "12px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            alignItems: "flex-end",
          }}
        >
          <label style={{ display: "grid", gap: "6px", minWidth: "260px", flex: 1 }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>Program</span>
            <select
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedSemester("");
              }}
              style={ttInput}
              disabled={loading || programs.length === 0}
            >
              {programs.length === 0 && <option value="">No programs</option>}
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", width: "180px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>Semester</span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              style={ttInput}
              disabled={!selectedProgramId}
            >
              <option value="">Select semester</option>
              {Array.from({ length: semesterCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  Semester {n}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-add"
            onClick={() => openCreate()}
            disabled={!selectedProgramId || !selectedSemester}
          >
            <IconPlus size={16} aria-hidden="true" />
            Add Slot
          </button>
        </section>

        {error && <p className="admin-message error">{error}</p>}
        {message && <p className="admin-message success">{message}</p>}

        {!loading && !selectedProgram && (
          <div className="cs-empty">Create a program first to build its timetable.</div>
        )}

        {selectedProgram && !selectedSemester && (
          <div className="cs-empty">Pick a semester to view and edit its weekly timetable.</div>
        )}

        {/* Weekly grid */}
        {selectedProgram && selectedSemester && (
          <section
            style={{
              padding: "18px 20px",
              borderRadius: "12px",
              background: "var(--panel)",
              border: "1px solid var(--line)",
            }}
          >
            <TimetableGrid
              items={scheduledBlocks.map((b) => ({
                ...b,
                conflict: conflictedBlocks.has(b.id),
                subjectTeacherName: teacherName(b.teacherId),
              }))}
              onTrackClick={(day, minutes) => handleTrackClick(day, minutes)}
              onBlockClick={(b) => openEdit(b as Block)}
              onLunchClick={(b) => openEdit(b as Block)}
              trackHint={(day) => `Click to schedule a ${day.toLowerCase()} class`}
            />
          </section>
        )}

        {/* Unscheduled curriculum subjects for this semester */}
        {selectedProgram && selectedSemester && (
          <section
            style={{
              padding: "18px 20px",
              borderRadius: "12px",
              background: "var(--panel)",
              border: "1px solid var(--line)",
            }}
          >
            <strong style={{ display: "block", marginBottom: "10px" }}>
              Curriculum coverage — Semester {selectedSemester}
            </strong>
            {classSubjectOptions.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)" }}>
                No coded subjects found in the published curriculum for this semester.
              </p>
            ) : unscheduledSubjects.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#059669",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <IconCircleCheck size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                Every curriculum subject has at least one scheduled slot.
              </p>
            ) : (
              <div className="tt-unscheduled">
                {unscheduledSubjects.map((course) => (
                  <span key={course.key} className="tt-chip">
                    <strong>{course.code}</strong>
                    {course.name}
                    <button
                      type="button"
                      title="Schedule this subject"
                      onClick={() => {
                        openCreate();
                        const subjectId = resolveSubjectId(course);
                        setClassForm((cf) => ({
                          ...cf,
                          subjectId,
                          teacherId: subjectId
                            ? (assignedTeachersFor(subjectId)[0]?.id ?? "")
                            : cf.teacherId,
                        }));
                      }}
                    >
                      <IconPlus size={13} aria-hidden="true" />
                      Schedule
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Modal: Add Class Slot */}
        {showClassModal && selectedProgram && (
          <AdminModal
            title="Schedule New Class Slot"
            onClose={() => setShowClassModal(false)}
          >
            <form className="modal-form" onSubmit={handleCreateClass}>
              <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 700 }}>
                {selectedProgram.code} ·{" "}
                <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>
                  Semester {selectedSemester}
                </span>
              </p>

              <label>
                Subject
                <select
                  value={classForm.subjectId}
                  onChange={(e) => {
                    const subjectId = e.target.value;
                    if (subjectId === LUNCH_OPTION) {
                      setClassForm({ ...classForm, subjectId, teacherId: "", type: "Lunch", group: "" });
                      return;
                    }
                    const options = assignedTeachersFor(subjectId);
                    setClassForm({
                      ...classForm,
                      subjectId,
                      teacherId: options[0]?.id ?? "",
                      type: classForm.type === "Lunch" ? "Lecture" : classForm.type,
                    });
                  }}
                  required
                >
                  <option value="">
                    {classSubjectOptions.length === 0
                      ? "No subjects in curriculum for this semester"
                      : "Select Subject"}
                  </option>
                  <option value={LUNCH_OPTION} disabled={lunchExists}>
                    {lunchExists ? "Lunch Break (already set — click it on the table)" : "Lunch Break"}
                  </option>
                  {classSubjectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Teacher (from subject assignment)
                <select
                  value={classForm.teacherId}
                  onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}
                  required
                  disabled={createIsLunch || assignedTeachersFor(classForm.subjectId).length === 0}
                >
                  {createIsLunch ? (
                    <option value="">No teacher — campus break</option>
                  ) : assignedTeachersFor(classForm.subjectId).length === 0 ? (
                    <option value="">No teacher assigned to this subject</option>
                  ) : (
                    <>
                      <option value="">Select Teacher</option>
                      {assignedTeachersFor(classForm.subjectId).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.employeeNo})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <span className="form-hint">
                  {createIsLunch
                    ? "The lunch break is a campus-wide slot — no teacher is assigned."
                    : "Auto-filled from subject assignments. Assign teachers to subjects on the Faculty page."}
                </span>
              </label>

              <div className="inline-pair">
                <label>
                  Weekday
                  <select
                    value={classForm.dayOfWeek}
                    onChange={(e) => setClassForm({ ...classForm, dayOfWeek: e.target.value })}
                    required
                  >
                    {WORK_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="inline-pair">
                <label>
                  Start Time
                  <input
                    type="time"
                    value={classForm.startTime}
                    onChange={(e) =>
                      setClassForm({ ...classForm, startTime: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  End Time
                  <input
                    type="time"
                    value={classForm.endTime}
                    onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="inline-pair">
                <label>
                  Slot Type
                  <select
                    value={classForm.type}
                    onChange={(e) => setClassForm({ ...classForm, type: e.target.value })}
                    required
                    disabled={createIsLunch}
                  >
                    {createIsLunch && <option value="Lunch">Lunch Break</option>}
                    <option value="Lecture">Lecture</option>
                    <option value="Practical">Practical</option>
                  </select>
                </label>
                <label>
                  Group (optional)
                  <input
                    type="text"
                    placeholder="e.g. Gr. A"
                    value={classForm.group}
                    onChange={(e) => setClassForm({ ...classForm, group: e.target.value })}
                    disabled={createIsLunch}
                  />
                </label>
              </div>

              {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

              <div className="modal-actions">
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Scheduling…" : (
                    <>
                      <IconPlus size={15} aria-hidden="true" />
                      Schedule Class
                    </>
                  )}
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => setShowClassModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal: Edit Class Slot */}
        {editingClass && selectedProgram && (
          <AdminModal
            title="Edit Class Slot"
            onClose={() => setEditingClass(null)}
          >
            <form className="modal-form" onSubmit={handleUpdateClass}>
              <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 700 }}>
                {selectedProgram.code} ·{" "}
                <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>
                  Semester {selectedSemester}
                </span>
              </p>

              <label>
                Subject
                <select
                  value={editingClass.subjectId}
                  onChange={(e) => {
                    const subjectId = e.target.value;
                    if (subjectId === LUNCH_OPTION) {
                      setEditingClass({ ...editingClass, subjectId, teacherId: "", type: "Lunch", group: "" });
                      return;
                    }
                    const options = assignedTeachersFor(subjectId);
                    setEditingClass({
                      ...editingClass,
                      subjectId,
                      teacherId: options[0]?.id ?? "",
                    });
                  }}
                  required
                  disabled={editIsLunch}
                >
                  <option value="">
                    {editClassSubjectOptions.length === 0
                      ? "No subjects in curriculum for this semester"
                      : "Select Subject"}
                  </option>
                  <option value={LUNCH_OPTION}>Lunch Break</option>
                  {editClassSubjectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Teacher (from subject assignment)
                <select
                  value={editingClass.teacherId}
                  onChange={(e) => setEditingClass({ ...editingClass, teacherId: e.target.value })}
                  required
                  disabled={editIsLunch || assignedTeachersFor(editingClass.subjectId).length === 0}
                >
                  {editIsLunch ? (
                    <option value="">No teacher — campus break</option>
                  ) : assignedTeachersFor(editingClass.subjectId).length === 0 ? (
                    <option value="">No teacher assigned to this subject</option>
                  ) : (
                    <>
                      <option value="">Select Teacher</option>
                      {assignedTeachersFor(editingClass.subjectId).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.employeeNo})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <span className="form-hint">
                  Auto-filled from subject assignments. Assign teachers to subjects on the Faculty
                  page.
                </span>
              </label>

              <div className="inline-pair">
                <label>
                  Weekday
                  <select
                    value={editingClass.dayOfWeek}
                    onChange={(e) => setEditingClass({ ...editingClass, dayOfWeek: e.target.value })}
                    required
                  >
                    {WORK_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="inline-pair">
                <label>
                  Start Time
                  <input
                    type="time"
                    value={editingClass.startTime}
                    onChange={(e) => setEditingClass({ ...editingClass, startTime: e.target.value })}
                    required
                  />
                </label>
                <label>
                  End Time
                  <input
                    type="time"
                    value={editingClass.endTime}
                    onChange={(e) => setEditingClass({ ...editingClass, endTime: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="inline-pair">
                <label>
                  Slot Type
                  <select
                    value={editingClass.type}
                    onChange={(e) => setEditingClass({ ...editingClass, type: e.target.value })}
                    required
                    disabled={editIsLunch}
                  >
                    {editIsLunch && <option value="Lunch">Lunch Break</option>}
                    <option value="Lecture">Lecture</option>
                    <option value="Practical">Practical</option>
                  </select>
                </label>
                <label>
                  Group (optional)
                  <input
                    type="text"
                    placeholder="e.g. Gr. A"
                    value={editingClass.group}
                    onChange={(e) => setEditingClass({ ...editingClass, group: e.target.value })}
                    disabled={editIsLunch}
                  />
                </label>
              </div>

              {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

              <div className="modal-actions">
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving Changes…" : "Save Changes"}
                </button>
                <button className="btn-ghost" type="button" onClick={() => setEditingClass(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal: Delete Class Slot */}
        {deletingClass && (
          <AdminModal title="Delete Class Slot" onClose={() => setDeletingClass(null)}>
            <div className="modal-confirm-box">
              <p>
                Delete the slot for{" "}
                <strong>
                  {deletingClass.subject.name} ({deletingClass.subject.code})
                </strong>{" "}
                on {deletingClass.dayOfWeek} ({formatTime(deletingClass.startTime)} –{" "}
                {formatTime(deletingClass.endTime)})?
              </p>
              <p
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#dc2626",
                  background: "rgba(220, 38, 38, 0.08)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                }}
              >
                <IconAlertTriangle size={16} aria-hidden="true" />
                Deleting this schedule removes its attendance sessions and student records.
              </p>
              {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}
              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button className="btn-danger" type="button" onClick={handleDeleteClass} disabled={saving}>
                  {saving ? "Deleting…" : "Yes, Delete Slot"}
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => setDeletingClass(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </AdminShell>
  );
}
