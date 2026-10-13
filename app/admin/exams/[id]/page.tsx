"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
import { IconAlertTriangle, IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";

type SubjectKind = "THEORY" | "PRACTICAL";
type ExamType = "END_SEMESTER" | "MID_TERM";
type EntryRole = "ADMIN" | "TEACHER";

type ExamSubject = {
  id: string;
  subjectId: string;
  code: string;
  name: string;
  kind: SubjectKind;
  credits: number;
  maxMarks: number;
  marksPublishedAt: string | null;
  entryRole: EntryRole;
};

type RosterStudent = { id: string; rollNumber: number | null; enrollmentNumber: string; name: string };

type RoutineEntry = { id: string; date: string; order: number; subjectId: string | null; subject: { code: string; name: string } | null };

type MarkCell = { marks: number; grade: string | null; gradePoint: number | null };

type PublishGate = {
  canPublish: boolean;
  blockers: string[];
  subjects: Array<{ id: string; subject: { code: string }; complete: boolean; missing: number; entryRole: EntryRole }>;
};

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
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [routine, setRoutine] = useState<RoutineEntry[]>([]);
  const [marks, setMarks] = useState<Record<string, MarkCell>>({});
  const [gate, setGate] = useState<PublishGate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Local editable grid: cells["examSubjectId:studentId"] = "85".
  const [cells, setCells] = useState<Record<string, string>>({});
  // Routine draft rows: manual date + subject pick (arbitrary gaps allowed).
  const [routineDraft, setRoutineDraft] = useState<{ date: string; subjectId: string }[]>([]);

  const [savingMarks, setSavingMarks] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [publishingRoutine, setPublishingRoutine] = useState(false);
  const [publishingResult, setPublishingResult] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // --- Registration deadline (admin-configurable) ---
  const [deadline, setDeadline] = useState<string | null>(null);
  const [deadlineDraft, setDeadlineDraft] = useState<string>("");
  const [deadlineSecondsLeft, setDeadlineSecondsLeft] = useState<number | null>(null);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [deadlineMessage, setDeadlineMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const pad = (n: number) => String(n).padStart(2, "0");

  /** Formats a UTC date for display. */
  function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  /** Whether the registration form is currently open. */
  function deadlineOpen(deadlineIso: string | null | undefined): boolean {
    if (!deadlineIso) return true; // legacy sessions stay open until results publish
    return new Date(deadlineIso).getTime() >= Date.now();
  }

  function deadlineContrast(deadline: string | null | undefined) {
    const now = new Date();
    const due = deadline ? new Date(deadline) : null;
    if (!due) return "pending";
    const diff = due.getTime() - now.getTime();
    if (diff < 0) return "expired";
    if (diff < 24 * 60 * 60 * 1000) return "urgent";
    return "open";
  }

  function deadlineSeconds(deadline: string | null | undefined) {
    if (!deadline) return null;
    const due = new Date(deadline).getTime();
    if (isNaN(due)) return null;
    return Math.max(0, Math.ceil((due - Date.now()) / 1000));
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
      setGate(data.publishGate);
      const seeded: Record<string, string> = {};
      for (const [key, cell] of Object.entries((data.marks ?? {}) as Record<string, MarkCell>)) {
        seeded[key] = String(cell.marks);
      }
      setCells(seeded);
      setDeadline(data.exam.registrationDeadline);
      setDeadlineDraft(
        data.exam.registrationDeadline
          ? `${data.exam.registrationDeadline.slice(0, 10)}T00:00:00Z`
          : "",
      );
      setDeadlineSecondsLeft(deadlineSeconds(data.exam.registrationDeadline));
      setRoutineDraft(
        (data.routine ?? []).map((r: RoutineEntry) => ({
          date: r.date ? String(r.date).slice(0, 10) : "",
          subjectId: r.subjectId ?? "",
        })),
      );
    } catch {
      setNotice({ kind: "error", text: "Unable to load exam" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Live countdown that refreshes once per minute.
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      setDeadlineSecondsLeft(deadlineSeconds(deadline));
    };
    const id = window.setInterval(tick, 60_000);
    tick();
    return () => window.clearInterval(id);
  }, [deadline]);

  async function saveDeadline() {
    if (!id || savingDeadline) return;
    if (!deadlineDraft) {
      setDeadlineMessage({ kind: "error", text: "Enter a deadline first" });
      return;
    }
    const parsed = new Date(deadlineDraft);
    if (isNaN(parsed.getTime())) {
      setDeadlineMessage({ kind: "error", text: "Enter a valid date/time" });
      return;
    }
    setSavingDeadline(true);
    setDeadlineMessage(null);
    try {
      const res = await fetch(`/api/admin/exams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationDeadline: parsed.toISOString() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeadlineMessage({ kind: "error", text: body.error ?? "Unable to update deadline" });
        return;
      }
      setDeadline(parsed.toISOString());
      setDeadlineSecondsLeft(deadlineSeconds(parsed.toISOString()));
      setDeadlineMessage({ kind: "ok", text: "Registration deadline updated" });
    } catch {
      setDeadlineMessage({ kind: "error", text: "Unable to update deadline" });
    } finally {
      setSavingDeadline(false);
    }
  }

  async function clearDeadline() {
    if (!id || savingDeadline) return;
    setSavingDeadline(true);
    setDeadlineMessage(null);
    try {
      const res = await fetch(`/api/admin/exams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationDeadline: null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeadlineMessage({ kind: "error", text: body.error ?? "Unable to clear deadline" });
        return;
      }
      setDeadline(null);
      setDeadlineSecondsLeft(null);
      setDeadlineMessage({ kind: "ok", text: "Registration deadline cleared" });
    } catch {
      setDeadlineMessage({ kind: "error", text: "Unable to clear deadline" });
    } finally {
      setSavingDeadline(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading state then fetches; this fetch-on-id-change pattern is the desired behavior
    load();
  }, [load]);

  const adminSubjects = useMemo(() => subjects.filter((s) => s.entryRole === "ADMIN"), [subjects]);

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
        for (const student of roster) {
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
      const res = await fetch(`/api/admin/exams/${id}/routine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: routineDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error ?? "Unable to save routine" });
        return;
      }
      setNotice({ kind: "ok", text: "Routine saved" });
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
            <Button onClick={publishResult} disabled={publishingResult || !gate?.canPublish}>
              {publishingResult ? "Publishing…" : "Publish Result"}
            </Button>
          )}
        </div>
      </div>

      {/* Registration window: deadline setter + live status badge */}
      <div className="mb-5">
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="flex-1">
              <label className="text-sm font-medium" htmlFor="exam-deadline">
                Form submission deadline
              </label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="exam-deadline"
                  type="datetime-local"
                  value={deadlineDraft}
                  onChange={(e) => {
                    setDeadlineDraft(e.target.value);
                    setNotice(null);
                  }}
                  placeholder="Y-m-dTH:i"
                  aria-describedby="exam-deadline-error exam-deadline-note"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const local = new Date(
                      now.getTime() + now.getTimezoneOffset() * 60_000,
                    );
                    const iso = new Date(
                      local.getFullYear(),
                      local.getMonth(),
                      local.getDate(),
                      local.getHours(),
                      local.getMinutes(),
                    ).toISOString();
                    setDeadlineDraft(iso.slice(0, 16));
                    setNotice(null);
                  }}
                >
                  Now
                </Button>
              </div>
              {deadline && (
                <p
                  id="exam-deadline-note"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  {formatDate(deadline)}
                  {deadlineSecondsLeft !== null && ` · ${deadlineSecondsLeft}s remaining`}
                </p>
              )}
              {deadline && (
                <p
                  id="exam-deadline-error"
                  className={`mt-1 text-xs ${
                    deadlineContrast(deadline) === "expired"
                      ? "text-red-600"
                      : deadlineContrast(deadline) === "urgent"
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {deadlineContrast(deadline) === "expired"
                    ? "Expired — registrations are closed."
                    : deadlineContrast(deadline) === "urgent"
                    ? "Closes in under 24h."
                    : "In the future."}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {deadline && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDeadline}
                  disabled={savingDeadline}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={saveDeadline}
                disabled={savingDeadline || !deadlineDraft}
              >
                {savingDeadline ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          {deadlineMessage && (
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-sm ${
                deadlineMessage.kind === "ok"
                  ? "border-[var(--ctp-green)]/40 text-[var(--ctp-green)]"
                  : "border-destructive/40 text-destructive"
              }`}
            >
              {deadlineMessage.text}
            </p>
          )}
        </Card>

        {/* Live deadline status badge */}
        <div className="flex items-center gap-2 pt-2">
            <Badge variant={deadline ? "default" : "secondary"}>
            {deadline
              ? deadlineContrast(deadline) === "expired"
                ? "Registration closed"
                : deadlineContrast(deadline) === "urgent"
                ? "Registration closing soon"
                : "Registration open"
              : "No deadline set"}
            {deadlineSecondsLeft !== null && deadlineContrast(deadline) !== "expired" && (
              <span className="ml-2 text-xs text-muted-foreground">{deadlineSecondsLeft}s</span>
            )}
          </Badge>
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
          {!resultsPublished && (
            <Button variant="outline" size="sm" onClick={saveRoutine} disabled={savingRoutine}>
              {savingRoutine ? "Saving…" : "Save Routine"}
            </Button>
          )}
        </div>
        <CardContent className="pt-4">
          <div className="mb-3 grid gap-2">
            {routine.length === 0 && (
              <p className="text-sm text-muted-foreground">No routine built yet.</p>
            )}
            {routine.map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-muted-foreground">{index + 1}.</span>
                <span className="w-40">
                  {entry.date ? new Date(entry.date).toLocaleDateString() : "—"}
                </span>
                <span>{entry.subject ? `${entry.subject.code} — ${entry.subject.name}` : "TBA"}</span>
              </div>
            ))}
          </div>

          {!resultsPublished && (
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Build routine — dates are manual (arbitrary gaps allowed)
              </p>
              <div className="grid gap-2">
                {routineDraft.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        setRoutineDraft((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, date: e.target.value } : r)),
                        )
                      }
                      className="w-44"
                    />
                    <select
                      value={row.subjectId}
                      onChange={(e) =>
                        setRoutineDraft((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, subjectId: e.target.value } : r)),
                        )
                      }
                      className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Select subject…</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.subjectId}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRoutineDraft((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <IconTrash size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setRoutineDraft((prev) => [...prev, { date: "", subjectId: "" }])}
              >
                <IconPlus size={16} />
                Add Day
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publish gate */}
      {gate && !resultsPublished && (
        <Card className="mb-5 rounded-xl">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {gate.canPublish ? (
                <>
                  <IconCheck size={18} className="text-[var(--ctp-green)]" />
                  <span className="text-sm font-medium text-[var(--ctp-green)]">
                    All subjects complete — ready to publish results.
                  </span>
                </>
              ) : (
                <>
                  <IconAlertTriangle size={18} className="text-[var(--ctp-yellow)]" />
                  <span className="text-sm font-medium">Results not ready yet.</span>
                </>
              )}
            </div>
            {gate.blockers.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                {gate.blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Marking table */}
      <Card className="rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            <h3 className="font-semibold">Marking Table</h3>
            <p className="text-sm text-muted-foreground">
              {adminSubjects.length > 0
                ? "Enter marks for the theory (admin-entered) subjects below."
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
          {roster.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active students in this program + semester yet.
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
                          {s.kind === "PRACTICAL" ? " · PRAC" : ""}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((student) => (
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
                              disabled={resultsPublished}
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
    </AdminShell>
  );
}