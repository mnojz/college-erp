"use client";

import { useCallback, useEffect, useState } from "react";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
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
import { IconArrowLeft } from "@tabler/icons-react";

type ExamSubjectItem = {
  examSubjectId: string;
  sessionId: string;
  maxMarks: number;
  marksPublishedAt: string | null;
  entryRole: "ADMIN" | "TEACHER";
  subject: { id: string; code: string; name: string; kind: "THEORY" | "PRACTICAL" };
  session: {
    id: string;
    title: string;
    type: "END_SEMESTER" | "MID_TERM";
    status: string;
    semester: number;
    program: { name: string; code: string };
  };
  markCount: number;
  registeredCount: number;
};

type RosterStudent = { id: string; rollNumber: number | null; enrollmentNumber: string; name: string };

type Detail = {
  examSubject: {
    id: string;
    sessionId: string;
    title: string;
    type: "END_SEMESTER" | "MID_TERM";
    semester: number;
    maxMarks: number;
    marksPublishedAt: string | null;
    subject: { code: string; name: string; kind: "THEORY" | "PRACTICAL" };
  };
  roster: RosterStudent[];
  marks: Record<string, { marks: number; grade: string | null; gradePoint: number | null } | null>;
};

export default function TeacherExamsPage() {
  const [items, setItems] = useState<ExamSubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExamSubjectItem | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/exams");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading state then fetches; this fetch-on-mount pattern is the desired behavior
    load();
  }, [load]);

  async function openSubject(item: ExamSubjectItem) {
    setSelected(item);
    setDetail(null);
    setNotice(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${item.sessionId}/${item.examSubjectId}`);
      if (!res.ok) {
        setNotice({ kind: "error", text: "Unable to load subject" });
        return;
      }
      const data: Detail = await res.json();
      setDetail(data);
      const seeded: Record<string, string> = {};
      for (const [studentId, mark] of Object.entries(data.marks)) {
        if (mark) seeded[studentId] = String(mark.marks);
      }
      setCells(seeded);
    } catch {
      setNotice({ kind: "error", text: "Unable to load subject" });
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveMarks() {
    if (!selected || !detail) return;
    setSaving(true);
    setNotice(null);
    try {
      const payload = [];
      for (const student of detail.roster) {
        const raw = cells[student.id];
        if (raw === undefined || raw.trim() === "") continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || value > detail.examSubject.maxMarks) {
          setNotice({ kind: "error", text: `Marks must be 0–${detail.examSubject.maxMarks}` });
          setSaving(false);
          return;
        }
        payload.push({ studentId: student.id, marks: value });
      }
      const res = await fetch(`/api/teacher/exams/${selected.sessionId}/${selected.examSubjectId}`, {
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
      openSubject(selected);
    } catch {
      setNotice({ kind: "error", text: "Unable to save marks" });
    } finally {
      setSaving(false);
    }
  }

  async function publishMarks() {
    if (!selected) return;
    setPublishing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/teacher/exams/${selected.sessionId}/${selected.examSubjectId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error ?? "Unable to publish marks" });
        return;
      }
      setNotice({ kind: "ok", text: "Marks published" });
      load();
      openSubject(selected);
    } catch {
      setNotice({ kind: "error", text: "Unable to publish marks" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <TeacherShell title="Exam Marks" subtitle="Enter and publish marks for your subjects" active="/teacher/exams">
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

      {selected ? (
        /* ── Mark-entry view for one subject ── */
        <div>
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => setSelected(null)}>
            <IconArrowLeft size={16} />
            All subjects
          </Button>
          <Card className="rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
              <div>
                <h3 className="font-semibold">
                  {selected.subject.code} — {selected.subject.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selected.session.title} · {selected.session.program.name} · Semester{" "}
                  {selected.session.semester} · max {selected.maxMarks}
                </p>
              </div>
              <div className="flex gap-2">
                {detail?.examSubject.marksPublishedAt ? (
                  <Badge variant="success">Published</Badge>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={saveMarks} disabled={saving || detailLoading}>
                      {saving ? "Saving…" : "Save Draft"}
                    </Button>
                    <Button size="sm" onClick={publishMarks} disabled={publishing || detailLoading}>
                      {publishing ? "Publishing…" : "Publish Marks"}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <CardContent className="pt-4">
              {detailLoading || !detail ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : detail.roster.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No students registered for this subject yet — the marking list
                  opens once students submit the exam form.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="w-32 text-center">
                          Marks /{detail.examSubject.maxMarks}
                        </TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.roster.map((student) => {
                        const saved = detail.marks[student.id];
                        const draft = cells[student.id];
                        return (
                          <TableRow key={student.id}>
                            <TableCell>
                              <div className="font-medium">{student.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {student.rollNumber != null
                                  ? `Roll ${student.rollNumber}`
                                  : student.enrollmentNumber}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={detail.examSubject.maxMarks}
                                value={draft ?? ""}
                                onChange={(e) =>
                                  setCells((prev) => ({ ...prev, [student.id]: e.target.value }))
                                }
                                disabled={detail.examSubject.marksPublishedAt !== null}
                                className="h-8 w-24 text-center"
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {saved?.grade ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── Landing list of assigned exam subjects ── */
        <div>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Your Exam Subjects</h2>
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="rounded-xl border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No exam subjects need your marks right now. Mid-term and practical entries appear
                here once an exam is created.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <Card key={item.examSubjectId} className="rounded-xl">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {item.subject.code} — {item.subject.name}
                        </h3>
                        {item.marksPublishedAt && <Badge variant="success">Published</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.session.title} · {item.session.program.name} · Semester{" "}
                        {item.session.semester} · max {item.maxMarks}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {item.markCount} / {item.registeredCount} entered
                      </span>
                      <Button size="sm" onClick={() => openSubject(item)}>
                        {item.markCount > 0 ? "Edit Marks" : "Enter Marks"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </TeacherShell>
  );
}