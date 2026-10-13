"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCertificate,
  IconChevronLeft,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExamDetail, ExamRoutineRow, ExamSubjectCell, ExamType } from "@/app/types/exam";

const TYPE_LABEL: Record<ExamType, string> = {
  END_SEMESTER: "End-Semester",
  MID_TERM: "Mid-Term",
};

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: ExamDetail };

/** One rendered routine line: a real paper, or a synthetic break between two
 *  non-consecutive papers (ported from the admin read-only view). */
type RoutineDisplayRow =
  | { kind: "entry"; key: string; entry: ExamRoutineRow }
  | { kind: "gap"; key: string; days: number };

function shell(children: React.ReactNode) {
  return (
    <StudentShell active="/student/exams" title="Exams" subtitle="Exam routine and registration">
      <div className="flex flex-col gap-5">{children}</div>
    </StudentShell>
  );
}

/** Date + time for the read-only deadline read-out (same format as admin). */
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

/** Routine subject cell: code + muted name (mirrors the admin read-only view). */
function RoutineSubject({ subject }: { subject: { code: string; name: string } | null }) {
  if (!subject) return <span className="text-sm text-muted-foreground">TBA</span>;
  return (
    <span>
      <span className="font-semibold">{subject.code}</span>
      <span className="ml-2 text-sm text-muted-foreground">{subject.name}</span>
    </span>
  );
}

/** ExamSubject ids currently registered across the table's TH/PR cells. */
function registeredRowIds(rows: ExamDetail["rows"]): string[] {
  return rows.flatMap((row) =>
    [row.th, row.pr]
      .filter((cell): cell is ExamSubjectCell => cell !== null && cell.registered)
      .map((cell) => cell.id),
  );
}

export default function StudentExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });
  // Draft selection — the ExamSubject ids currently checked on the form.
  const [selection, setSelection] = useState<string[]>([]);
  // "view" = read-only form (+ Edit button), "edit" = checkboxes + Submit.
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/student/exams/${id}`, { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({ status: "error", message: body.error ?? "Unable to load exam" });
          return;
        }
        const data: ExamDetail = await res.json();
        const registered = registeredRowIds(data.rows);
        setSelection(registered);
        // First-timers land in edit mode with an empty form; returning students
        // see their submitted form read-only until they press Edit. A closed
        // window is always read-only.
        setMode(data.window.open && registered.length === 0 ? "edit" : "view");
        setState({ status: "ready", detail: data });
      } catch {
        setState({ status: "error", message: "Unable to load exam" });
      }
    }

    load();
  }, [id]);

  const detail = state.status === "ready" ? state.detail : null;
  const windowOpen = detail?.window.open ?? false;
  const canEdit = windowOpen && mode === "edit";

  // The draft differs from what the server has saved.
  const dirty = useMemo(() => {
    if (!detail) return false;
    const saved = registeredRowIds(detail.rows);
    if (saved.length !== selection.length) return true;
    const savedIds = new Set(saved);
    return selection.some((sid) => !savedIds.has(sid));
  }, [detail, selection]);

  // Routine rows for display: sorted by date with synthetic gap rows between
  // non-consecutive papers (ported from the admin read-only view). Gap = days
  // strictly between (Jan 1 → Jan 4 = "2 days gap"); consecutive or same-day
  // papers produce no gap row.
  const routineRows = useMemo<RoutineDisplayRow[]>(() => {
    const routine = detail?.routine ?? [];
    const sorted = routine
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const ta = a.entry.date ? new Date(a.entry.date).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.entry.date ? new Date(b.entry.date).getTime() : Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        return a.index - b.index;
      });
    const rows: RoutineDisplayRow[] = [];
    let prev: ExamRoutineRow | null = null;
    for (const { entry, index } of sorted) {
      if (prev && prev.date && entry.date) {
        const diffDays = Math.round(
          (new Date(entry.date).getTime() - new Date(prev.date).getTime()) / 86_400_000,
        );
        if (diffDays > 1) {
          rows.push({ kind: "gap", key: `gap-${index}`, days: diffDays - 1 });
        }
      }
      rows.push({ kind: "entry", key: `entry-${index}`, entry });
      prev = entry;
    }
    return rows;
  }, [detail]);

  function toggleCell(examSubjectId: string) {
    setSelection((prev) =>
      prev.includes(examSubjectId)
        ? prev.filter((x) => x !== examSubjectId)
        : [...prev, examSubjectId],
    );
  }

  async function submit() {
    if (submitting || selection.length === 0) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/student/exams/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examSubjectIds: selection }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: "error", text: body.error ?? "Unable to submit the exam form" });
        return;
      }
      // Mirror the saved set locally: rows now reflect the submission and the
      // form flips back to read-only with an Edit button.
      const savedIds = new Set(selection);
      setState((prev) =>
        prev.status === "ready"
          ? {
              ...prev,
              detail: {
                ...prev.detail,
                hasRegistrations: true,
                rows: prev.detail.rows.map((row) => ({
                  ...row,
                  th: row.th ? { ...row.th, registered: savedIds.has(row.th.id) } : null,
                  pr: row.pr ? { ...row.pr, registered: savedIds.has(row.pr.id) } : null,
                })),
              },
            }
          : prev,
      );
      setMode("view");
      setNotice({
        kind: "ok",
        text: `Exam form submitted for ${selection.length} part${selection.length === 1 ? "" : "s"}.`,
      });
    } catch {
      setNotice({ kind: "error", text: "Unable to submit the exam form" });
    } finally {
      setSubmitting(false);
    }
  }

  /** Registration-table cell: —, a locked "Passed", or the part's checkbox. */
  function renderCell(cell: ExamSubjectCell | null, label: string) {
    if (!cell) return <span className="text-sm text-muted-foreground">—</span>;
    if (cell.passed && !cell.registered) {
      return <span className="text-xs font-medium text-muted-foreground">Passed</span>;
    }
    return (
      <div className="flex flex-col items-center gap-1">
        <Checkbox
          checked={selection.includes(cell.id)}
          disabled={!canEdit}
          onCheckedChange={() => toggleCell(cell.id)}
          aria-label={label}
        />
        <span className="text-[10px] text-muted-foreground">/{cell.maxMarks}</span>
      </div>
    );
  }

  if (state.status === "loading") {
    return shell(
      <div className="grid gap-3">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>,
    );
  }

  if (state.status === "error") {
    return shell(
      <Card className="rounded-xl border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <IconAlertTriangle size={26} aria-hidden="true" />
          </span>
          <div>
            <p className="font-heading text-base font-semibold">Exam not available</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/student/exams">Back to exams</Link>
          </Button>
        </CardContent>
      </Card>,
    );
  }

  const { exam, routine, rows, hasRegistrations } = state.detail;

  return shell(
    <>
      <Link
        href="/student/exams"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <IconChevronLeft size={14} aria-hidden="true" />
        Back to exams
      </Link>

      {/* Exam info header */}
      <Card className="rounded-xl">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconCertificate size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading truncate font-semibold">{exam.title}</p>
                <Badge variant="outline">{TYPE_LABEL[exam.type]}</Badge>
                {exam.isBacklog && <Badge variant="secondary">Backlog</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Semester {exam.semester}
                {exam.program ? ` · ${exam.program.name}` : ""}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <IconCalendarEvent size={14} aria-hidden="true" />
                Form deadline: {formatDateTime(exam.registrationDeadline)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {exam.resultsPublishedAt && <Badge variant="outline">Results published</Badge>}
            <Badge variant={windowOpen ? "default" : "secondary"} className="gap-1.5">
              {windowOpen ? "Registration open" : "Registration closed"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {notice && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "border-[var(--ctp-green)]/40 text-[var(--ctp-green)]"
              : "border-destructive/40 text-destructive"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Read-only routine */}
      <Card className="rounded-xl">
        <div className="flex items-center justify-between px-4 pt-4">
          <h3 className="font-semibold">Exam Routine</h3>
          {exam.routinePublishedAt && <Badge variant="outline">Published</Badge>}
        </div>
        <CardContent className="pt-4">
          {routine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The routine has not been published yet — check back soon.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 border-r bg-muted/30 text-sm font-semibold text-foreground">
                      Day
                    </TableHead>
                    <TableHead className="border-r bg-muted/30 text-sm font-semibold text-foreground">
                      Date
                    </TableHead>
                    <TableHead className="bg-muted/30 text-sm font-semibold text-foreground">
                      Subject
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routineRows.map((row) =>
                    row.kind === "gap" ? (
                      <TableRow key={row.key}>
                        <TableCell
                          colSpan={3}
                          className="text-center text-sm font-medium italic text-muted-foreground"
                        >
                          — {row.days} day{row.days === 1 ? "" : "s"} gap —
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={row.key}>
                        <TableCell className="whitespace-nowrap border-r text-sm font-medium text-foreground">
                          {routineWeekday(row.entry.date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap border-r text-sm font-medium text-foreground">
                          {routineDateShort(row.entry.date)}
                        </TableCell>
                        <TableCell>
                          <RoutineSubject subject={row.entry.subject} />
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TH/PR registration form */}
      <Card className="rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            <h3 className="font-semibold">Exam Registration</h3>
            <p className="text-sm text-muted-foreground">
              {rows.length > 0
                ? "Tick the parts you will appear for and submit the form."
                : "This exam session has no subjects to register for."}
            </p>
          </div>
          {windowOpen && hasRegistrations && mode === "view" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMode("edit");
                setNotice(null);
              }}
            >
              Edit
            </Button>
          )}
        </div>
        <CardContent className="pt-4">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No subjects are part of this exam session.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Code</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-32 text-center">Theory (TH)</TableHead>
                    <TableHead className="w-32 text-center">Practical (PR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.subjectId}>
                      <TableCell className="whitespace-nowrap font-medium">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-center">
                        {renderCell(row.th, `${row.code} theory`)}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderCell(row.pr, `${row.code} practical`)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {!windowOpen
                  ? "The form submission deadline has passed — the form is locked."
                  : hasRegistrations
                    ? mode === "edit"
                      ? "Editing your submitted form — submit again to save your changes."
                      : "You have submitted this exam form. You can edit it until the deadline."
                    : "Choose your parts and submit — you can edit the form until the deadline."}
              </p>
              {windowOpen && mode === "edit" && (
                <Button
                  onClick={() => void submit()}
                  disabled={submitting || selection.length === 0 || !dirty}
                >
                  {submitting
                    ? "Submitting…"
                    : hasRegistrations
                      ? "Submit Changes"
                      : "Submit Registration"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>,
  );
}
