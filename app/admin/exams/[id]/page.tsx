"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";

type SubjectKind = "THEORY" | "PRACTICAL";
type ExamType = "END_SEMESTER" | "MID_TERM";
type EntryRole = "ADMIN" | "TEACHER";

type ExamSubject = {
  id: string;
  subjectId: string;
  code: string;
  name: string;
  part: SubjectKind;
  credits: number;
  maxMarks: number;
  marksPublishedAt: string | null;
  entryRole: EntryRole;
};

type RosterStudent = { id: string; rollNumber: number | null; enrollmentNumber: string; name: string };

type RoutineEntry = { id: string; date: string; order: number; subjectId: string | null; subject: { code: string; name: string } | null };

type MarkCell = { marks: number; grade: string | null; gradePoint: number | null };

type ExamDetail = {
  id: string;
  title: string;
  type: ExamType;
  status: "DRAFT" | "ANNOUNCED" | "RESULTS_PUBLISHED";
  semester: number;
  routinePublishedAt: string | null;
  resultsPublishedAt: string | null;
  program: { id: string; name: string; code: string };
  academicYear: { id: string; name: string } | null;
};

const TYPE_LABEL: Record<ExamType, string> = {
  END_SEMESTER: "End-Semester",
  MID_TERM: "Mid-Term",
};

export default function AdminExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [routine, setRoutine] = useState<RoutineEntry[]>([]);
  const [marks, setMarks] = useState<Record<string, MarkCell>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Local editable grid: cells["examSubjectId:studentId"] = "85".
  const [cells, setCells] = useState<Record<string, string>>({});
  // Routine draft rows: manual date + subject pick (arbitrary gaps allowed).
  const [routineDraft, setRoutineDraft] = useState<{ date: string; subjectId: string }[]>([]);
  // True = editing the routine; false = viewing the saved routine.
  const [routineEditing, setRoutineEditing] = useState(true);

  const [savingMarks, setSavingMarks] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [publishingRoutine, setPublishingRoutine] = useState(false);
  const [publishingResult, setPublishingResult] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // --- Registration deadline (read-only; set at exam creation) ---
  const [deadline, setDeadline] = useState<string | null>(null);
  // Per-exam-subject set of student ids that registered for that part.
  const [registeredBySubject, setRegisteredBySubject] = useState<Record<string, string[]>>({});

  /** Date + time for the read-only deadline read-out. */
  function formatDateTime(iso: string | null | undefined) {
    if (!iso) return "Not set";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Not set";
    return d.toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /** Compact [Mon DD] label used across the routine. */
  function routineDayLabel(value: string | Date) {
    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "[ — ]";
    const mon = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `[${mon} ${day}]`;
  }

  /** Short weekday ("Tue") for a routine table Day column. */
  function routineWeekday(value: string | null | undefined) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  }

  /** Compact "05 Jan" label for a routine table Date column. */
  function routineDateShort(value: string | null | undefined) {
    if (!value) return "TBA";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "TBA";
    const mon = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${day} ${mon}`;
  }

  /** Load the current registration deadline and kick off the live countdown. */
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/exams/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setNotice({ kind: "error", text: "Unable to load exam" });
        setLoading(false);
        return;
      }
      const data = await res.json();
      setExam(data.exam);
      setSubjects(data.subjects);
      setRoster(data.roster);
      setRoutine(data.routine);
      setMarks(data.marks ?? {});
      setRegisteredBySubject(data.registeredBySubject ?? {});
      const seeded: Record<string, string> = {};
      for (const [key, cell] of Object.entries((data.marks ?? {}) as Record<string, MarkCell>)) {
        seeded[key] = String(cell.marks);
      }
      setCells(seeded);
      setDeadline(data.exam.registrationDeadline);
      // Routine draft: restore the saved routine, else pre-create one slot per
      // theoretical subject with the subject pre-filled — the admin only sets
      // dates (practical-only subjects are evaluated separately, so they never
      // appear in the written routine).
      const savedRoutine = (data.routine ?? []) as RoutineEntry[];
      const resultsPublished = Boolean(data.exam.resultsPublishedAt);
      if (savedRoutine.length > 0) {
        setRoutineDraft(
          savedRoutine.map((r) => ({
            date: r.date ? String(r.date).slice(0, 10) : "",
            subjectId: r.subjectId ?? "",
          })),
        );
        setRoutineEditing(false);
      } else {
        const theoryIds = Array.from(
          new Set(
            (data.subjects as ExamSubject[])
              .filter((s) => s.part === "THEORY")
              .map((s) => s.subjectId),
          ),
        );
        setRoutineDraft(theoryIds.map((subjectId) => ({ date: "", subjectId })));
        // Start in edit mode when there is nothing built yet.
        setRoutineEditing(!resultsPublished && theoryIds.length > 0);
      }
    } catch {
      setNotice({ kind: "error", text: "Unable to load exam" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading state then fetches; this fetch-on-id-change pattern is the desired behavior
    load();
  }, [load]);

  const adminSubjects = useMemo(() => subjects.filter((s) => s.entryRole === "ADMIN"), [subjects]);

  // Distinct theory subjects keyed by subjectId — drives the routine builder's
  // fixed subject labels (practical-only subjects are evaluated separately and
  // never appear in the written routine).
  const theorySubjectById = useMemo(() => {
    const seen = new Map<string, { code: string; name: string }>();
    for (const s of subjects) {
      if (s.part !== "THEORY") continue;
      if (!seen.has(s.subjectId)) seen.set(s.subjectId, { code: s.code, name: s.name });
    }
    return seen;
  }, [subjects]);

  /** Renders a routine subject cell: code bold + name muted, with a fallback. */
  function subjectCell(subject: { code: string; name: string } | null | undefined, fallback: string) {
    if (!subject) return <span className="text-muted-foreground">{fallback}</span>;
    return (
      <>
        <span className="font-medium">{subject.code}</span>{" "}
        <span className="text-muted-foreground">{subject.name}</span>
      </>
    );
  }

  // Students who registered for at least one part of this exam.
  const registeredStudentIds = useMemo(() => {
    const set = new Set<string>();
    for (const ids of Object.values(registeredBySubject)) for (const id of ids) set.add(id);
    return set;
  }, [registeredBySubject]);

  // The marking table lists only students who actually submitted the form.
  const markableRoster = useMemo(
    () => roster.filter((r) => registeredStudentIds.has(r.id)),
    [roster, registeredStudentIds],
  );

  const isRegistered = (examSubjectId: string, studentId: string) =>
    (registeredBySubject[examSubjectId] ?? []).includes(studentId);

  // Earliest routine date — drives the read-only "Exam starts" info.
  const earliestRoutineDate = useMemo(() => {
    const times = routine
      .map((r) => (r.date ? new Date(r.date).getTime() : NaN))
      .filter((t) => !Number.isNaN(t));
    return times.length ? new Date(Math.min(...times)) : null;
  }, [routine]);

  // Routine rows for display, sorted by date (stable: ties keep saved order).
  const routineDisplayRows = useMemo(() => {
    return [...routine].sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return a.order - b.order;
    });
  }, [routine]);

  // The routine draft is saveable once every pre-filled slot has a date.
  const routineDraftReady =
    routineDraft.length > 0 && routineDraft.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));

  const cellKey = (examSubjectId: string, studentId: string) => `${examSubjectId}:${studentId}`;

  function setCell(examSubjectId: string, studentId: string, value: string) {
    setCells((prev) => ({ ...prev, [cellKey(examSubjectId, studentId)]: value }));
  }

  async function saveMarks() {
    setSavingMarks(true);
    setNotice(null);
    try {
      const payload = [];
      for (const subject of adminSubjects) {
        for (const student of markableRoster) {
          const raw = cells[cellKey(subject.id, student.id)];
          if (raw === undefined || raw.trim() === "") continue;
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0 || value > subject.maxMarks) {
            setNotice({ kind: "error", text: `${subject.code}: marks must be 0–${subject.maxMarks}` });
            setSavingMarks(false);
            return;
          }
          payload.push({ examSubjectId: subject.id, studentId: student.id, marks: value });
        }
      }
      const res = await fetch(`/api/admin/exams/${id}/marks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error ?? "Unable to save marks" });
        return;
      }
      setNotice({ kind: "ok", text: `Saved ${payload.length} mark(s)` });
      load();
    } catch {
      setNotice({ kind: "error", text: "Unable to save marks" });
    } finally {
      setSavingMarks(false);
    }
  }

  async function saveRoutine() {
    setSavingRoutine(true);
    setNotice(null);
    try {
      // Persist in chronological order so `order` matches the day sequence.
      const entries = [...routineDraft].sort((a, b) => a.date.localeCompare(b.date));
      const res = await fetch(`/api/admin/exams/${id}/routine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error ?? "Unable to save routine" });
        return;
      }
      setNotice({ kind: "ok", text: "Routine saved" });
      setRoutineEditing(false);
      load();
    } catch {
      setNotice({ kind: "error", text: "Unable to save routine" });
    } finally {
      setSavingRoutine(false);
    }
  }

  async function publishRoutine() {
    setPublishingRoutine(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/exams/${id}/publish-routine`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error ?? "Unable to publish routine" });
        return;
      }
      setNotice({ kind: "ok", text: "Exam announced to students" });
      load();
    } catch {
      setNotice({ kind: "error", text: "Unable to publish routine" });
    } finally {
      setPublishingRoutine(false);
    }
  }

  async function publishResult() {
    setPublishingResult(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/exams/${id}/publish-result`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          Array.isArray(data.blockers) && data.blockers.length ? ` — ${data.blockers.join("; ")}` : "";
        setNotice({ kind: "error", text: (data.error ?? "Unable to publish results") + detail });
        return;
      }
      setNotice({ kind: "ok", text: "Results published — students notified" });
      load();
    } catch {
      setNotice({ kind: "error", text: "Unable to publish results" });
    } finally {
      setPublishingResult(false);
    }
  }

  async function handleDelete() {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/exams/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error ?? "Unable to delete exam" });
        setDeleting(false);
        return;
      }
      router.push("/admin/exams");
    } catch {
      setNotice({ kind: "error", text: "Unable to delete exam" });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <AdminShell title="Exam" subtitle="Loading…" active="/admin/exams">
        <Skeleton className="h-40 w-full rounded-xl" />
      </AdminShell>
    );
  }

  if (notFound || !exam) {
    return (
      <AdminShell title="Exam" subtitle="Not found" active="/admin/exams">
        <Card className="rounded-xl">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This exam session does not exist.
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  const resultsPublished = exam.resultsPublishedAt !== null;
  const totalStudents = roster.length;

  return (
    <AdminShell
      title={exam.title}
      subtitle={`${exam.program.name} · Semester ${exam.semester} · ${TYPE_LABEL[exam.type]}`}
      active="/admin/exams"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              exam.status === "DRAFT" ? "secondary" : exam.status === "ANNOUNCED" ? "default" : "outline"
            }
          >
            {exam.status === "DRAFT" ? "Draft" : exam.status === "ANNOUNCED" ? "Announced" : "Results Published"}
          </Badge>
          {exam.academicYear && <Badge variant="outline">{exam.academicYear.name}</Badge>}
          <span className="text-sm text-muted-foreground">{totalStudents} student(s)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!exam.routinePublishedAt && (
            <Button variant="outline" onClick={publishRoutine} disabled={publishingRoutine || routine.length === 0}>
              {publishingRoutine ? "Announcing…" : "Announce Exam"}
            </Button>
          )}
          {!resultsPublished && (
            <Button onClick={publishResult} disabled={publishingResult}>
              {publishingResult ? "Publishing…" : "Publish Result"}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            className="gap-1"
          >
            <IconTrash size={16} />
            Delete Exam
          </Button>
        </div>
      </div>

      {/* Read-only exam info: form deadline (set at creation) + exam start. */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Form submission deadline</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatDateTime(deadline)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exam starts</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {earliestRoutineDate ? routineDayLabel(earliestRoutineDate) : "Not scheduled yet"}
          </p>
        </div>
      </div>

      {notice && (
        <p
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "border-[var(--ctp-green)]/40 text-[var(--ctp-green)]"
              : "border-destructive/40 text-destructive"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Routine builder */}
      <Card className="mb-5 rounded-xl">
        <div className="flex items-center justify-between px-4 pt-4">
          <h3 className="font-semibold">Exam Routine</h3>
          {!resultsPublished && (routineEditing || routineDraft.length > 0) && (
            <Button
              variant={routineEditing ? "default" : "outline"}
              size="sm"
              onClick={routineEditing ? saveRoutine : () => setRoutineEditing(true)}
              disabled={savingRoutine || (routineEditing && !routineDraftReady)}
            >
              {savingRoutine ? "Saving…" : routineEditing ? "Save Routine" : "Edit Routine"}
            </Button>
          )}
        </div>
        <CardContent className="pt-4">
          {routineEditing ? (
            routineDraft.length === 0 ? (
              <p className="text-sm text-muted-foreground">No theory subjects to schedule.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 border-r bg-muted/30">Day</TableHead>
                      <TableHead className="border-r bg-muted/30">Date</TableHead>
                      <TableHead className="bg-muted/30">Subject</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routineDraft.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="border-r whitespace-nowrap text-xs text-muted-foreground">
                          {routineWeekday(row.date)}
                        </TableCell>
                        <TableCell className="w-64 border-r">
                          <Input
                            type="date"
                            value={row.date}
                            onChange={(e) =>
                              setRoutineDraft((prev) =>
                                prev.map((r, i) =>
                                  i === index ? { ...r, date: e.target.value } : r,
                                ),
                              )
                            }
                            className="w-40"
                          />
                        </TableCell>
                        <TableCell>
                          {subjectCell(theorySubjectById.get(row.subjectId), "Subject not in this exam")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : routine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {theorySubjectById.size === 0
                ? "No theory subjects to schedule."
                : "No routine built yet."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 border-r bg-muted/30">Day</TableHead>
                    <TableHead className="border-r bg-muted/30">Date</TableHead>
                    <TableHead className="bg-muted/30">Subject</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routineDisplayRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="border-r whitespace-nowrap text-xs text-muted-foreground">
                        {routineWeekday(row.date)}
                      </TableCell>
                      <TableCell className="border-r whitespace-nowrap text-xs text-muted-foreground">
                        {routineDateShort(row.date)}
                      </TableCell>
                      <TableCell>{subjectCell(row.subject, "TBA")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marking table */}
      <Card className="rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            <h3 className="font-semibold">Marking Table</h3>
            <p className="text-sm text-muted-foreground">
              {adminSubjects.length > 0
                ? `${markableRoster.length} student(s) registered. Enter marks for the theory (admin-entered) subjects below.`
                : "This exam has no admin-entered subjects."}
            </p>
          </div>
          {!resultsPublished && adminSubjects.length > 0 && (
            <Button onClick={saveMarks} disabled={savingMarks}>
              {savingMarks ? "Saving…" : "Save Draft"}
            </Button>
          )}
        </div>
        <CardContent className="pt-4">
          {markableRoster.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No students have submitted the exam form yet — marks open once students register.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-48 bg-background">Student</TableHead>
                    {subjects.map((s) => (
                      <TableHead key={s.id} className="min-w-28 text-center">
                        <div className="font-medium">{s.code}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          /{s.maxMarks}
                          {s.part === "PRACTICAL" ? " · PRAC" : ""}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markableRoster.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="sticky left-0 z-10 bg-background">
                        <div className="font-medium">{student.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {student.rollNumber != null ? `Roll ${student.rollNumber}` : student.enrollmentNumber}
                        </div>
                      </TableCell>
                      {subjects.map((s) => {
                        const saved = marks[cellKey(s.id, student.id)];
                        if (s.entryRole === "TEACHER") {
                          return (
                            <TableCell key={s.id} className="text-center">
                              {saved ? (
                                <span className="text-sm font-medium">{saved.marks}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                              <div className="text-[10px] text-muted-foreground">
                                {s.marksPublishedAt ? "published" : "teacher"}
                              </div>
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={s.id} className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={s.maxMarks}
                              value={cells[cellKey(s.id, student.id)] ?? ""}
                              onChange={(e) => setCell(s.id, student.id, e.target.value)}
                              disabled={resultsPublished || !isRegistered(s.id, student.id)}
                              className="h-8 w-20 text-center"
                              placeholder="—"
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle size={18} className="text-destructive" />
              Delete exam?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium">{exam.title}</span> and all of
              its subjects, routine, registrations, and marks. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}