"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { TimetableGrid } from "@/app/components/timetable/TimetableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import {
  IconAlertTriangle,
  IconCoffee,
  IconLayersLinked,
  IconPlus,
} from "@tabler/icons-react";

type ProgramOption = {
  id: string;
  name: string;
  code: string;
  durationYears: number;
  departmentName?: string;
};

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

type TeacherOption = {
  id: string;
  name: string;
  employeeNo: string;
};

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
  semesterNo: number;
  programId: string;
};

type Block = ClassItem & {
  startMin: number;
  endMin: number;
  conflict: boolean;
};

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

  // Primary data state
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Published curricula (source of truth for courses)
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

  // Selection
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("1");

  // Modals state
  const [showClassModal, setShowClassModal] = useState(false);
  const [slotMode, setSlotMode] = useState<"class" | "break">("class");
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [editingClass, setEditingClass] = useState<{ id: string } & typeof emptyClassForm | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);
  const [editingBreak, setEditingBreak] = useState<BreakRow | null>(null);
  const [deletingBreak, setDeletingBreak] = useState<BreakRow | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ─── Initial Load ────────────────────────────────────────────────
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
        if (loadedPrograms.length > 0) {
          setSelectedProgramId(loadedPrograms[0].id);
          setSelectedSemester("1");
        }
      } catch {
        setError("Unable to load scheduling records");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // ─── Program & Semester Computations ─────────────────────────────
  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );
  const semesterCount = selectedProgram ? selectedProgram.durationYears * 2 : 0;

  const programCurriculum = useMemo(
    () => curricula.find((c) => c.programId === selectedProgramId) ?? null,
    [curricula, selectedProgramId],
  );

  // Flatten published curriculum into semester courses
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

  // Resolve curriculum course code to operational Subject ID
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

  // Scheduled blocks for active program + semester
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

  // Overlap / Conflict detection
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
        const aType = a.type ?? "Lecture";
        const bType = b.type ?? "Lecture";
        if (aType !== bType) continue;
        const differentGroups = !!a.group && !!b.group && a.group !== b.group;
        if (aType === "Practical" && differentGroups) continue;
        flagged.add(a.id);
        flagged.add(b.id);
      }
    }
    return flagged;
  }, [scheduledBlocks]);

  // Break window for active program + semester
  const breakFor = useMemo(
    () =>
      breaks.find(
        (b) => b.programId === selectedProgramId && b.semester === Number(selectedSemester),
      ) ?? null,
    [breaks, selectedProgramId, selectedSemester],
  );

  // Teachers mapped by subject
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

  const assignedTeachersFor = useCallback(
    (subjectId: string) => teachersBySubject.get(subjectId) ?? [],
    [teachersBySubject],
  );

  const teacherName = useCallback(
    (id: string | null) => (id && teachers.find((t) => t.id === id)?.name) || "Unassigned",
    [teachers],
  );


  // Subject options for class modal
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

  const displayBlocks = scheduledBlocks;

  // ─── Handlers ────────────────────────────────────────────────────
  function openCreate(day?: string, startMin?: number) {
    const start = startMin ?? FALLBACK_START;
    setError("");
    setSlotMode("class");
    setClassForm({
      subjectId: classSubjectOptions[0]?.id ?? "",
      teacherId: classSubjectOptions[0]?.id
        ? (assignedTeachersFor(classSubjectOptions[0].id)[0]?.id ?? "")
        : "",
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

  function openEditBreak() {
    if (!breakFor) {
      // Create new break
      setSlotMode("break");
      setClassForm({
        ...emptyClassForm,
        startTime: "12:00",
        endTime: "13:00",
      });
      setShowClassModal(true);
      return;
    }
    setError("");
    setEditingBreak({
      ...breakFor,
      startTime: minutesToHHMM(timeToMinutes(breakFor.startTime) ?? 0),
      endTime: minutesToHHMM(timeToMinutes(breakFor.endTime) ?? 0),
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
    return `This time overlaps the campus break (${formatTime(breakFor.startTime)} – ${formatTime(
      breakFor.endTime,
    )}). No class can be scheduled during the break on any weekday.`;
  }

  async function handleCreateClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProgramId || !selectedSemester) return;

    if (slotMode === "break") {
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
        toast.success("Break period set successfully.");
      } catch {
        setError("Unable to reach the server");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!classForm.subjectId) {
      setError("Please select a subject.");
      return;
    }

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
          teacherId: classForm.teacherId || null,
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
      toast.success("Class scheduled successfully.");
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
          teacherId: editingClass.teacherId || null,
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
      toast.success("Class updated successfully.");
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
        toast.error(data.error ?? "Failed to delete class slot");
        return;
      }
      setClasses((prev) => prev.filter((c) => c.id !== deletingClass.id));
      toast.success("Class slot deleted successfully.");
      setDeletingClass(null);
    } catch {
      setError("Unable to reach the server");
      toast.error("Unable to reach the server");
    } finally {
      setSaving(false);
    }
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
      toast.success("Break updated successfully.");
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
        toast.error(data.error ?? "Failed to remove the break");
        return;
      }
      setBreaks((prev) => prev.filter((b) => b.id !== deletingBreak.id));
      toast.success("Break removed — time is available for classes again.");
      setDeletingBreak(null);
    } catch {
      setError("Unable to reach the server");
      toast.error("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  const createIsBreak = slotMode === "break";

  return (
    <AdminShell
      title="Class Scheduling"
      subtitle="Timetable & Lecture Slot Management"
      active="/admin/teaching"
    >
      <div className="flex flex-col gap-5">
        {/* ── Top Header Toolbar: Program, Semester & Quick Actions ── */}
        <Card className="rounded-xl border border-border/70 p-4 shadow-xs bg-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            {/* Left: Program & Semester Pickers (Equally Wide) */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="w-full sm:w-64">
                <Label htmlFor="sched-program" className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Degree Program
                </Label>
                <Select
                  value={selectedProgramId || undefined}
                  onValueChange={(val) => {
                    setSelectedProgramId(val);
                    setSelectedSemester("1");
                  }}
                  disabled={loading || programs.length === 0}
                >
                  <SelectTrigger id="sched-program" className="h-9.5 text-xs font-semibold w-full">
                    <IconLayersLinked size={15} className="text-primary mr-1.5 shrink-0" />
                    <SelectValue placeholder="Select program..." />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <span className="font-bold">{p.code}</span> — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-64">
                <Label htmlFor="sched-sem" className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Semester
                </Label>
                <Select
                  value={selectedSemester || undefined}
                  onValueChange={(val) => setSelectedSemester(val)}
                  disabled={!selectedProgramId || semesterCount === 0}
                >
                  <SelectTrigger id="sched-sem" className="h-9.5 text-xs font-semibold w-full">
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

            {/* Right: Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {/* Daily Break Status / Edit Button */}
              <Button
                type="button"
                size="sm"
                onClick={openEditBreak}
                disabled={!selectedProgramId || !selectedSemester}
                className="h-9 gap-1.5 text-xs font-semibold border-0 bg-muted hover:bg-muted/80 text-primary shadow-2xs cursor-pointer"
                title={breakFor ? "Edit the campus daily break window" : "Configure daily campus break"}
              >
                <IconCoffee size={15} className="text-primary" />
                {breakFor ? (
                  <>
                    Break: {formatTime(breakFor.startTime)} – {formatTime(breakFor.endTime)}
                  </>
                ) : (
                  "Set Break"
                )}
              </Button>

              {/* Add Class Slot Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => openCreate()}
                disabled={!selectedProgramId || !selectedSemester}
                className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
              >
                <IconPlus size={15} />
                Add Class Slot
              </Button>
            </div>
          </div>
        </Card>

        {/* Global Error Notice */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
            <IconAlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Weekly Matrix Timetable ── */}
        <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden bg-card">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span>Weekly Matrix Timetable</span>
              <Badge variant="outline" className="font-mono text-xs">
                {selectedProgram?.code} · Semester {selectedSemester}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <TimetableGrid
              items={displayBlocks.map((b) => ({
                ...b,
                conflict: conflictedBlocks.has(b.id),
                subjectTeacherName: teacherName(b.teacherId),
              }))}
              breakPeriod={breakFor ? { start: breakFor.startTime, end: breakFor.endTime } : null}
              onTrackClick={(day, minutes) => openCreate(day, minutes)}
              onBlockClick={(b) => openEdit(b as Block)}
              onBreakClick={openEditBreak}
              trackHint={(day) => `Click to schedule a class on ${titleCaseDay(day)}`}
            />
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MODAL 1: ADD CLASS SLOT / BREAK                           */}
        {/* ══════════════════════════════════════════════════════════ */}
        {showClassModal && selectedProgram && (
          <AdminModal title="Schedule Class Slot" onClose={() => setShowClassModal(false)}>
            <form className="grid gap-4" onSubmit={handleCreateClass}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-bold">{selectedProgram.code}</Badge>
                <span className="text-xs text-muted-foreground font-semibold">Semester {selectedSemester}</span>
              </div>

              {/* Slot Mode: Class slot vs Break period */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setSlotMode("class")}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    !createIsBreak
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Class Lecture / Lab
                </button>
                <button
                  type="button"
                  onClick={() => setSlotMode("break")}
                  disabled={!!breakFor}
                  title={breakFor ? "Break already set — click it to edit" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                    createIsBreak
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Campus Break Window
                </button>
              </div>

              {createIsBreak && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  Reserves this time on <strong>every weekday (Mon–Fri)</strong>. No class can be scheduled during this interval.
                </div>
              )}

              {!createIsBreak && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="class-subject" className="text-xs font-semibold">Course / Subject</Label>
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
                      <SelectTrigger id="class-subject" className="w-full text-xs font-medium h-9">
                        <SelectValue
                          placeholder={
                            classSubjectOptions.length === 0
                              ? "No subjects in curriculum for this semester"
                              : "Select subject..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {classSubjectOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id} className="text-xs">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="class-teacher" className="text-xs font-semibold">Instructor (From Subject Assignment)</Label>
                    <Select
                      value={classForm.teacherId || undefined}
                      onValueChange={(teacherId) => setClassForm({ ...classForm, teacherId })}
                      disabled={assignedTeachersFor(classForm.subjectId).length === 0}
                    >
                      <SelectTrigger id="class-teacher" className="w-full text-xs font-medium h-9">
                        <SelectValue
                          placeholder={
                            assignedTeachersFor(classForm.subjectId).length === 0
                              ? "No teacher assigned to this subject"
                              : "Select instructor..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {assignedTeachersFor(classForm.subjectId).map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.name} ({t.employeeNo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="class-day" className="text-xs font-semibold">Weekday</Label>
                      <Select
                        value={classForm.dayOfWeek}
                        onValueChange={(dayOfWeek) => setClassForm({ ...classForm, dayOfWeek })}
                      >
                        <SelectTrigger id="class-day" className="w-full text-xs font-medium h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {WORK_DAYS.map((day) => (
                            <SelectItem key={day} value={day} className="text-xs">
                              {titleCaseDay(day)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="class-type" className="text-xs font-semibold">Slot Type</Label>
                      <Select
                        value={classForm.type || undefined}
                        onValueChange={(type) => setClassForm({ ...classForm, type })}
                      >
                        <SelectTrigger id="class-type" className="w-full text-xs font-medium h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="Lecture" className="text-xs">Lecture</SelectItem>
                          <SelectItem value="Practical" className="text-xs">Practical / Lab</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="class-group" className="text-xs font-semibold">Group (Optional)</Label>
                      <Input
                        id="class-group"
                        type="text"
                        placeholder="e.g. Gr. A"
                        value={classForm.group}
                        onChange={(e) => setClassForm({ ...classForm, group: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="class-start" className="text-xs font-semibold">Start Time</Label>
                  <Input
                    id="class-start"
                    type="time"
                    value={classForm.startTime}
                    onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="class-end" className="text-xs font-semibold">End Time</Label>
                  <Input
                    id="class-end"
                    type="time"
                    value={classForm.endTime}
                    onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowClassModal(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="text-xs font-semibold">
                  {saving ? (
                    "Scheduling…"
                  ) : (
                    <>
                      <IconPlus size={15} />
                      {createIsBreak ? "Set Campus Break" : "Schedule Class"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MODAL 2: EDIT CLASS SLOT                                   */}
        {/* ══════════════════════════════════════════════════════════ */}
        {editingClass && selectedProgram && (
          <AdminModal title="Edit Class Slot" onClose={() => setEditingClass(null)}>
            <form className="grid gap-4" onSubmit={handleUpdateClass}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-bold">{selectedProgram.code}</Badge>
                <span className="text-xs text-muted-foreground font-semibold">Semester {selectedSemester}</span>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-subject" className="text-xs font-semibold">Subject</Label>
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
                  <SelectTrigger id="edit-subject" className="w-full text-xs font-medium h-9">
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
                      <SelectItem key={option.id} value={option.id} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-teacher" className="text-xs font-semibold">Instructor</Label>
                <Select
                  value={editingClass.teacherId || undefined}
                  onValueChange={(teacherId) => setEditingClass({ ...editingClass, teacherId })}
                  disabled={assignedTeachersFor(editingClass.subjectId).length === 0}
                >
                  <SelectTrigger id="edit-teacher" className="w-full text-xs font-medium h-9">
                    <SelectValue
                      placeholder={
                        assignedTeachersFor(editingClass.subjectId).length === 0
                          ? "No teacher assigned to this subject"
                          : "Select instructor"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {assignedTeachersFor(editingClass.subjectId).map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name} ({t.employeeNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-day" className="text-xs font-semibold">Weekday</Label>
                  <Select
                    value={editingClass.dayOfWeek}
                    onValueChange={(dayOfWeek) => setEditingClass({ ...editingClass, dayOfWeek })}
                  >
                    <SelectTrigger id="edit-day" className="w-full text-xs font-medium h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {WORK_DAYS.map((day) => (
                        <SelectItem key={day} value={day} className="text-xs">
                          {titleCaseDay(day)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-start" className="text-xs font-semibold">Start Time</Label>
                  <Input
                    id="edit-start"
                    type="time"
                    value={editingClass.startTime}
                    onChange={(e) => setEditingClass({ ...editingClass, startTime: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-end" className="text-xs font-semibold">End Time</Label>
                  <Input
                    id="edit-end"
                    type="time"
                    value={editingClass.endTime}
                    onChange={(e) => setEditingClass({ ...editingClass, endTime: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-type" className="text-xs font-semibold">Slot Type</Label>
                  <Select
                    value={editingClass.type || undefined}
                    onValueChange={(type) => setEditingClass({ ...editingClass, type })}
                  >
                    <SelectTrigger id="edit-type" className="w-full text-xs font-medium h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="Lecture" className="text-xs">Lecture</SelectItem>
                      <SelectItem value="Practical" className="text-xs">Practical / Lab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-group" className="text-xs font-semibold">Group (Optional)</Label>
                  <Input
                    id="edit-group"
                    type="text"
                    placeholder="e.g. Gr. A"
                    value={editingClass.group}
                    onChange={(e) => setEditingClass({ ...editingClass, group: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                <Button variant="outline" type="button" onClick={() => setEditingClass(null)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="text-xs font-semibold">
                  {saving ? "Saving Changes…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MODAL 3: DELETE CLASS CONFIRMATION                         */}
        {/* ══════════════════════════════════════════════════════════ */}
        {deletingClass && (
          <AdminModal title="Delete Class Slot" onClose={() => setDeletingClass(null)}>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Delete the scheduled slot for{" "}
                <strong className="text-foreground">
                  {deletingClass.subject.name} ({deletingClass.subject.code})
                </strong>{" "}
                on {titleCaseDay(deletingClass.dayOfWeek)} ({formatTime(deletingClass.startTime)} –{" "}
                {formatTime(deletingClass.endTime)})?
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                <IconAlertTriangle size={16} className="shrink-0" />
                <span>
                  Deleting this slot will also remove associated student attendance logs and sessions.
                </span>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="mt-2 flex flex-wrap justify-end gap-2.5">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeletingClass(null)}
                  disabled={saving}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleDeleteClass}
                  disabled={saving}
                  className="text-xs font-semibold"
                >
                  {saving ? "Deleting…" : "Confirm Delete"}
                </Button>
              </div>
            </div>
          </AdminModal>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MODAL 4: EDIT BREAK PERIOD                                 */}
        {/* ══════════════════════════════════════════════════════════ */}
        {editingBreak && (
          <AdminModal title="Edit Campus Break" onClose={() => setEditingBreak(null)}>
            <form className="grid gap-4" onSubmit={handleUpdateBreak}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-bold">{selectedProgram?.code}</Badge>
                <span className="text-xs text-muted-foreground font-semibold">Semester {selectedSemester}</span>
              </div>
              <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                The break period reserves this time window across <strong>all weekdays</strong>.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="break-start" className="text-xs font-semibold">Start Time</Label>
                  <Input
                    id="break-start"
                    type="time"
                    value={editingBreak.startTime}
                    onChange={(e) => setEditingBreak({ ...editingBreak, startTime: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="break-end" className="text-xs font-semibold">End Time</Label>
                  <Input
                    id="break-end"
                    type="time"
                    value={editingBreak.endTime}
                    onChange={(e) => setEditingBreak({ ...editingBreak, endTime: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex flex-wrap justify-between gap-2.5 pt-2">
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => {
                    setDeletingBreak(editingBreak);
                    setEditingBreak(null);
                  }}
                  disabled={saving}
                  className="text-xs font-semibold"
                >
                  Remove Break
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" type="button" onClick={() => setEditingBreak(null)} className="text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="text-xs font-semibold">
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </AdminModal>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MODAL 5: DELETE BREAK CONFIRMATION                         */}
        {/* ══════════════════════════════════════════════════════════ */}
        {deletingBreak && (
          <AdminModal title="Remove Break Period" onClose={() => setDeletingBreak(null)}>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Remove the daily break ({formatTime(deletingBreak.startTime)} –{" "}
                {formatTime(deletingBreak.endTime)})? This time will become available for classes again.
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="mt-2 flex flex-wrap justify-end gap-2.5">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeletingBreak(null)}
                  disabled={saving}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleDeleteBreak}
                  disabled={saving}
                  className="text-xs font-semibold"
                >
                  {saving ? "Removing…" : "Confirm Remove"}
                </Button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </AdminShell>
  );
}
