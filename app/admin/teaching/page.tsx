"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { TimetableGrid } from "@/app/components/timetable/TimetableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FALLBACK_START,
  formatTime,
  minutesToHHMM,
  timeToMinutes,
  WORK_DAYS,
} from "@/app/lib/timetable-layout";
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

// The break is its own entity (Break model) — NOT a class and NOT a subject:
// one daily reserved time window per program+semester timetable. It is added
// via the "Break period" mode in the slot editor, rendered as the hatched
// Mon–Fri band on the weekly grid, and no class may overlap it on any weekday
// (enforced server-side in /api/classes).
type BreakRow = {
  id: string;
  programId: string;
  semester: number;
  startTime: string;
  endTime: string;
};

const emptyClassForm = {
  subjectId: "",
  teacherId: "",
  // `as string` widens the literal from the `as const` WORK_DAYS tuple so the
  // form fields stay plain strings.
  dayOfWeek: WORK_DAYS[0] as string,
  startTime: "09:00",
  endTime: "10:30",
  type: "Lecture",
  group: "",
};

function titleCaseDay(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

export default function AdminTeachingPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
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
  // "Class slot" vs "Break period" mode inside the Add Slot dialog.
  const [slotMode, setSlotMode] = useState<"class" | "break">("class");
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [editingClass, setEditingClass] = useState<{ id: string } & typeof emptyClassForm | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);
  // The break being edited (opened by clicking the hatched band).
  const [editingBreak, setEditingBreak] = useState<BreakRow | null>(null);
  const [deletingBreak, setDeletingBreak] = useState<BreakRow | null>(null);

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
        const [pRes, sRes, cRes, bRes, tRes, curRes] = await Promise.all([
          fetch("/api/programs"),
          fetch("/api/subjects"),
          fetch("/api/classes"),
          fetch("/api/breaks"),
          fetch("/api/teachers"),
          fetch("/api/curriculum"),
        ]);
        const [pd, sd, cd, bd, td, curd] = await Promise.all([
          pRes.json(),
          sRes.json(),
          cRes.json(),
          bRes.json(),
          tRes.json(),
          curRes.json(),
        ]);
        const loadedPrograms: ProgramOption[] = pd.programs ?? [];
        setPrograms(loadedPrograms);
        setSubjects(sd.subjects ?? []);
        setClasses(cd.classes ?? []);
        setBreaks(bd.breaks ?? []);
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
        startMin: timeToMinutes(c.startTime) ?? FALLBACK_START,
        endMin: timeToMinutes(c.endTime) ?? FALLBACK_START + 90,
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

  // The break window for the selected table (at most one), if set.
  const breakFor = useMemo(
    () =>
      breaks.find(
        (b) => b.programId === selectedProgramId && b.semester === Number(selectedSemester),
      ) ?? null,
    [breaks, selectedProgramId, selectedSemester],
  );
  const createIsBreak = slotMode === "break";

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
    setSlotMode("class");
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
      startTime: minutesToHHMM(timeToMinutes(block.startTime) ?? 0),
      endTime: minutesToHHMM(timeToMinutes(block.endTime) ?? 0),
      type: block.type ?? "Lecture",
      group: block.group ?? "",
    });
  }

  async function refreshClasses() {
    const res = await fetch("/api/classes");
    const data = await res.json();
    setClasses(data.classes ?? []);
  }

  async function refreshBreaks() {
    const res = await fetch("/api/breaks");
    const data = await res.json();
    setBreaks(data.breaks ?? []);
  }

  /** Friendly pre-check: the server enforces the break window too (409). */
  function breaksOverlap(startHHMM: string, endHHMM: string): boolean {
    if (!breakFor) return false;
    const s = timeToMinutes(startHHMM);
    const e = timeToMinutes(endHHMM);
    const bs = timeToMinutes(breakFor.startTime);
    const be = timeToMinutes(breakFor.endTime);
    return s !== null && e !== null && bs !== null && be !== null && s < be && e > bs;
  }

  function breakOverlapError() {
    if (!breakFor) return "";
    return `This time overlaps the break (${formatTime(breakFor.startTime)} – ${formatTime(
      breakFor.endTime,
    )}). No class can be scheduled during the break on any day.`;
  }

  async function handleCreateClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProgramId || !selectedSemester) return;

    // Break mode: the break is NOT a class — no subject, teacher, day, or
    // slot type. It reserves its time window on every weekday.
    if (createIsBreak) {
      setError("");
      setSaving(true);
      try {
        const res = await fetch("/api/breaks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programId: selectedProgramId,
            semester: Number(selectedSemester),
            startTime: classForm.startTime,
            endTime: classForm.endTime,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to set the break");
          return;
        }
        await refreshBreaks();
        setShowClassModal(false);
        setMessage("Break set successfully.");
      } catch {
        setError("Unable to reach the server");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Radix Select has no native constraint validation — enforce the
    // "teacher required when the subject has assignments" rule here.
    if (assignedTeachersFor(classForm.subjectId).length > 0 && !classForm.teacherId) {
      setError("Select a teacher for this slot.");
      return;
    }
    if (breaksOverlap(classForm.startTime, classForm.endTime)) {
      setError(breakOverlapError());
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: selectedProgramId,
          semester: Number(selectedSemester),
          subjectId: classForm.subjectId,
          teacherId: classForm.teacherId,
          dayOfWeek: classForm.dayOfWeek,
          startTime: classForm.startTime,
          endTime: classForm.endTime,
          type: classForm.type,
          group: classForm.group,
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
    if (assignedTeachersFor(editingClass.subjectId).length > 0 && !editingClass.teacherId) {
      setError("Select a teacher for this slot.");
      return;
    }
    if (breaksOverlap(editingClass.startTime, editingClass.endTime)) {
      setError(breakOverlapError());
      return;
    }
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
          subjectId: editingClass.subjectId,
          teacherId: editingClass.teacherId,
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

  // ─── Break editor (opened by clicking the hatched band) ──────────
  function openEditBreak() {
    if (!breakFor) return;
    setError("");
    setEditingBreak({
      ...breakFor,
      startTime: minutesToHHMM(timeToMinutes(breakFor.startTime) ?? 0),
      endTime: minutesToHHMM(timeToMinutes(breakFor.endTime) ?? 0),
    });
  }

  async function handleUpdateBreak(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingBreak) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/breaks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBreak.id,
          startTime: editingBreak.startTime,
          endTime: editingBreak.endTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update the break");
        return;
      }
      await refreshBreaks();
      setEditingBreak(null);
      setMessage("Break updated successfully.");
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBreak() {
    if (!deletingBreak) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/breaks?id=${deletingBreak.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to remove the break");
        return;
      }
      setBreaks((prev) => prev.filter((b) => b.id !== deletingBreak.id));
      setMessage("Break removed — the time is available for classes again.");
      setDeletingBreak(null);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  const teacherName = (id: string | null) =>
    (id && teachers.find((t) => t.id === id)?.name) || "Unknown";

  return (
    <AdminShell title="Class Scheduling" subtitle="Timetable Management" active="/admin/teaching">
      <div className="flex flex-col gap-5">
        {/* Toolbar */}
        <Card size="sm">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-sm">
              <Label htmlFor="program-select">Program</Label>
              <Select
                value={selectedProgramId || undefined}
                onValueChange={(value) => {
                  setSelectedProgramId(value);
                  setSelectedSemester("");
                }}
                disabled={loading || programs.length === 0}
              >
                <SelectTrigger id="program-select" className="w-full">
                  <SelectValue
                    placeholder={programs.length === 0 ? "No programs" : "Select program"}
                  />
                </SelectTrigger>
                <SelectContent position="popper">
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5 sm:w-48">
              <Label htmlFor="semester-select">Semester</Label>
              <Select
                value={selectedSemester || undefined}
                onValueChange={(value) => setSelectedSemester(value)}
                disabled={!selectedProgramId}
              >
                <SelectTrigger id="semester-select" className="w-full">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {Array.from({ length: semesterCount }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Semester {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              onClick={() => openCreate()}
              disabled={!selectedProgramId || !selectedSemester}
              className="sm:ml-auto"
            >
              <IconPlus size={16} aria-hidden="true" />
              Add Slot
            </Button>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}

        {!loading && !selectedProgram && (
          <div className="rounded-xl border border-dashed px-8 py-10 text-center text-sm text-muted-foreground">
            Create a program first to build its timetable.
          </div>
        )}

        {selectedProgram && !selectedSemester && (
          <div className="rounded-xl border border-dashed px-8 py-10 text-center text-sm text-muted-foreground">
            Pick a semester to view and edit its weekly timetable.
          </div>
        )}

        {/* Weekly grid */}
        {selectedProgram && selectedSemester && (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Weekly timetable</CardTitle>
              <CardDescription>
                {selectedProgram.code} · Semester {selectedSemester} — click an empty slot to
                schedule a class at that time, or click a block to edit it.
              </CardDescription>
              <CardAction>
                {conflictedBlocks.size > 0 && (
                  <Badge variant="destructive">
                    {conflictedBlocks.size} overlapping {conflictedBlocks.size === 1 ? "slot" : "slots"}
                  </Badge>
                )}
              </CardAction>
            </CardHeader>
            <CardContent>
              <TimetableGrid
                items={scheduledBlocks.map((b) => ({
                  ...b,
                  conflict: conflictedBlocks.has(b.id),
                  subjectTeacherName: teacherName(b.teacherId),
                }))}
                breakPeriod={breakFor ? { start: breakFor.startTime, end: breakFor.endTime } : null}
                onTrackClick={(day, minutes) => handleTrackClick(day, minutes)}
                onBlockClick={(b) => openEdit(b as Block)}
                onBreakClick={openEditBreak}
                trackHint={(day) => `Click to schedule a ${day.toLowerCase()} class`}
              />
            </CardContent>
          </Card>
        )}

        {/* Unscheduled curriculum subjects for this semester */}
        {selectedProgram && selectedSemester && (
          <Card>
            <CardHeader>
              <CardTitle>Curriculum coverage</CardTitle>
              <CardDescription>
                Semester {selectedSemester} subjects from the published curriculum and whether they
                already have a scheduled slot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classSubjectOptions.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No coded subjects found in the published curriculum for this semester.
                </p>
              ) : unscheduledSubjects.length === 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                  <IconCircleCheck size={16} aria-hidden="true" className="shrink-0" />
                  Every curriculum subject has at least one scheduled slot.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unscheduledSubjects.map((course) => (
                    <span
                      key={course.key}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border bg-background py-1 pr-1 pl-3 text-xs"
                    >
                      <strong className="whitespace-nowrap font-semibold text-primary">
                        {course.code}
                      </strong>
                      <span className="min-w-0 truncate">{course.name}</span>
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
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
                      </Button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Modal: Add Class Slot */}
        {showClassModal && selectedProgram && (
          <AdminModal title="Schedule New Class Slot" onClose={() => setShowClassModal(false)}>
            <form className="grid gap-4" onSubmit={handleCreateClass}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedProgram.code}</Badge>
                <span className="text-sm text-muted-foreground">Semester {selectedSemester}</span>
              </div>

              {/* Slot kind: a regular class, or a break that reserves its time
                  on every weekday. Break mode hides subject/teacher/day/type. */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setSlotMode("class")}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    !createIsBreak
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Class slot
                </button>
                <button
                  type="button"
                  onClick={() => setSlotMode("break")}
                  disabled={!!breakFor}
                  title={breakFor ? "A break is already set — click it on the table to edit it" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    createIsBreak
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Break period
                </button>
              </div>
              {createIsBreak && (
                <p className="rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5 text-[13px] text-muted-foreground">
                  The break reserves this time on <strong className="text-foreground">every weekday</strong> — no
                  class can be scheduled during it, and it needs no subject, teacher, or day.
                </p>
              )}
              {breakFor && !createIsBreak && (
                <p className="text-xs text-muted-foreground">
                  A break is already set for this timetable ({formatTime(breakFor.startTime)} –{" "}
                  {formatTime(breakFor.endTime)}) — click it on the table to edit or remove it.
                </p>
              )}

              {!createIsBreak && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="class-subject">Subject</Label>
                    <Select
                      value={classForm.subjectId || undefined}
                      onValueChange={(subjectId) => {
                        const options = assignedTeachersFor(subjectId);
                        setClassForm({
                          ...classForm,
                          subjectId,
                          teacherId: options[0]?.id ?? "",
                        });
                      }}
                    >
                      <SelectTrigger id="class-subject" className="w-full">
                        <SelectValue
                          placeholder={
                            classSubjectOptions.length === 0
                              ? "No subjects in curriculum for this semester"
                              : "Select subject"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {classSubjectOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="class-teacher">Teacher (from subject assignment)</Label>
                <Select
                  value={classForm.teacherId || undefined}
                  onValueChange={(teacherId) => setClassForm({ ...classForm, teacherId })}
                  disabled={assignedTeachersFor(classForm.subjectId).length === 0}
                >
                  <SelectTrigger id="class-teacher" className="w-full">
                    <SelectValue
                      placeholder={
                        assignedTeachersFor(classForm.subjectId).length === 0
                          ? "No teacher assigned to this subject"
                          : "Select teacher"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {assignedTeachersFor(classForm.subjectId).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.employeeNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Auto-filled from subject assignments. Assign teachers to subjects on the Faculty page.
                </p>
              </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="class-day">Weekday</Label>
                    <Select
                      value={classForm.dayOfWeek}
                      onValueChange={(dayOfWeek) => setClassForm({ ...classForm, dayOfWeek })}
                    >
                      <SelectTrigger id="class-day" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {WORK_DAYS.map((day) => (
                          <SelectItem key={day} value={day}>
                            {titleCaseDay(day)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="class-type">Slot type</Label>
                      <Select
                        value={classForm.type || undefined}
                        onValueChange={(type) => setClassForm({ ...classForm, type })}
                      >
                        <SelectTrigger id="class-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="Lecture">Lecture</SelectItem>
                          <SelectItem value="Practical">Practical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="class-group">Group (optional)</Label>
                      <Input
                        id="class-group"
                        type="text"
                        placeholder="e.g. Gr. A"
                        value={classForm.group}
                        onChange={(e) => setClassForm({ ...classForm, group: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="class-start">Start time</Label>
                  <Input
                    id="class-start"
                    type="time"
                    value={classForm.startTime}
                    onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="class-end">End time</Label>
                  <Input
                    id="class-end"
                    type="time"
                    value={classForm.endTime}
                    onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    "Scheduling…"
                  ) : (
                    <>
                      <IconPlus size={15} aria-hidden="true" />
                      Schedule Class
                    </>
                  )}
                </Button>
                <Button variant="outline" type="button" onClick={() => setShowClassModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal: Edit Class Slot */}
        {editingClass && selectedProgram && (
          <AdminModal title="Edit Class Slot" onClose={() => setEditingClass(null)}>
            <form className="grid gap-4" onSubmit={handleUpdateClass}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedProgram.code}</Badge>
                <span className="text-sm text-muted-foreground">Semester {selectedSemester}</span>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-subject">Subject</Label>
                <Select
                  value={editingClass.subjectId || undefined}
                  onValueChange={(subjectId) => {
                    const options = assignedTeachersFor(subjectId);
                    setEditingClass({
                      ...editingClass,
                      subjectId,
                      teacherId: options[0]?.id ?? "",
                    });
                  }}
                >
                  <SelectTrigger id="edit-subject" className="w-full">
                    <SelectValue
                      placeholder={
                        editClassSubjectOptions.length === 0
                          ? "No subjects in curriculum for this semester"
                          : "Select subject"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {editClassSubjectOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-teacher">Teacher (from subject assignment)</Label>
                <Select
                  value={editingClass.teacherId || undefined}
                  onValueChange={(teacherId) => setEditingClass({ ...editingClass, teacherId })}
                  disabled={assignedTeachersFor(editingClass.subjectId).length === 0}
                >
                  <SelectTrigger id="edit-teacher" className="w-full">
                    <SelectValue
                      placeholder={
                        assignedTeachersFor(editingClass.subjectId).length === 0
                          ? "No teacher assigned to this subject"
                          : "Select teacher"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {assignedTeachersFor(editingClass.subjectId).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.employeeNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Auto-filled from subject assignments. Assign teachers to subjects on the Faculty page.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-day">Weekday</Label>
                  <Select
                    value={editingClass.dayOfWeek}
                    onValueChange={(dayOfWeek) => setEditingClass({ ...editingClass, dayOfWeek })}
                  >
                    <SelectTrigger id="edit-day" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {WORK_DAYS.map((day) => (
                        <SelectItem key={day} value={day}>
                          {titleCaseDay(day)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-start">Start time</Label>
                  <Input
                    id="edit-start"
                    type="time"
                    value={editingClass.startTime}
                    onChange={(e) => setEditingClass({ ...editingClass, startTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-end">End time</Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={editingClass.endTime}
                    onChange={(e) => setEditingClass({ ...editingClass, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-type">Slot type</Label>
                  <Select
                    value={editingClass.type || undefined}
                    onValueChange={(type) => setEditingClass({ ...editingClass, type })}
                  >
                    <SelectTrigger id="edit-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="Lecture">Lecture</SelectItem>
                      <SelectItem value="Practical">Practical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-group">Group (optional)</Label>
                  <Input
                    id="edit-group"
                    type="text"
                    placeholder="e.g. Gr. A"
                    value={editingClass.group}
                    onChange={(e) => setEditingClass({ ...editingClass, group: e.target.value })}
                  />
                </div>
              </div>

              {error && <p className="text-[13px] text-destructive">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2.5">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving Changes…" : "Save Changes"}
                </Button>
                <Button variant="outline" type="button" onClick={() => setEditingClass(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal: Delete Class Slot */}
        {deletingClass && (
          <AdminModal title="Delete Class Slot" onClose={() => setDeletingClass(null)}>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Delete the slot for{" "}
                <strong className="text-foreground">
                  {deletingClass.subject.name} ({deletingClass.subject.code})
                </strong>{" "}
                on {titleCaseDay(deletingClass.dayOfWeek)} ({formatTime(deletingClass.startTime)} –{" "}
                {formatTime(deletingClass.endTime)})?
              </p>
              <p className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive dark:border-destructive/40 dark:bg-destructive/20">
                <IconAlertTriangle size={16} aria-hidden="true" className="shrink-0" />
                Deleting this schedule removes its attendance sessions and student records.
              </p>
              {error && <p className="text-[13px] text-destructive">{error}</p>}
              <div className="mt-2 flex flex-wrap justify-end gap-2.5">
                <Button variant="destructive" type="button" onClick={handleDeleteClass} disabled={saving}>
                  {saving ? "Deleting…" : "Yes, Delete Slot"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeletingClass(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </AdminModal>
        )}

        {/* Modal: Edit Break */}
        {editingBreak && (
          <AdminModal title="Edit Break" onClose={() => setEditingBreak(null)}>
            <form className="grid gap-4" onSubmit={handleUpdateBreak}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedProgram?.code}</Badge>
                <span className="text-sm text-muted-foreground">Semester {selectedSemester}</span>
              </div>
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5 text-[13px] text-muted-foreground">
                The break reserves this time on <strong className="text-foreground">every weekday</strong> — no
                class can be scheduled during it.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="break-start">Start time</Label>
                  <Input
                    id="break-start"
                    type="time"
                    value={editingBreak.startTime}
                    onChange={(e) => setEditingBreak({ ...editingBreak, startTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="break-end">End time</Label>
                  <Input
                    id="break-end"
                    type="time"
                    value={editingBreak.endTime}
                    onChange={(e) => setEditingBreak({ ...editingBreak, endTime: e.target.value })}
                  />
                </div>
              </div>
              {error && <p className="text-[13px] text-destructive">{error}</p>}
              <div className="flex flex-wrap justify-between gap-2.5">
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => {
                    setDeletingBreak(editingBreak);
                    setEditingBreak(null);
                  }}
                  disabled={saving}
                >
                  Remove Break
                </Button>
                <div className="flex flex-wrap gap-2.5">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => setEditingBreak(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Modal: Delete Break */}
        {deletingBreak && (
          <AdminModal title="Remove Break" onClose={() => setDeletingBreak(null)}>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Remove the break ({formatTime(deletingBreak.startTime)} –{" "}
                {formatTime(deletingBreak.endTime)})? The time will become available for classes again.
              </p>
              {error && <p className="text-[13px] text-destructive">{error}</p>}
              <div className="mt-2 flex flex-wrap justify-end gap-2.5">
                <Button variant="destructive" type="button" onClick={handleDeleteBreak} disabled={saving}>
                  {saving ? "Removing…" : "Remove Break"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeletingBreak(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </AdminShell>
  );
}
