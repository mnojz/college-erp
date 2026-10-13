"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCertificate, IconPlus } from "@tabler/icons-react";

type Program = { id: string; name: string; code: string; durationYears: number };

type ExamListItem = {
  id: string;
  title: string;
  type: "END_SEMESTER" | "MID_TERM";
  status: "DRAFT" | "ANNOUNCED" | "RESULTS_PUBLISHED";
  semester: number;
  academicYear: { id: string; name: string } | null;
  program: { id: string; name: string; code: string };
  _count: { subjects: number; routine: number };
};

const TYPE_LABEL: Record<ExamListItem["type"], string> = {
  END_SEMESTER: "End-Semester",
  MID_TERM: "Mid-Term",
};

const STATUS_BADGE: Record<
  ExamListItem["status"],
  { label: string; variant: "secondary" | "default" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ANNOUNCED: { label: "Announced", variant: "default" },
  RESULTS_PUBLISHED: { label: "Results Published", variant: "outline" },
};

export default function AdminExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [formProgramId, setFormProgramId] = useState("");
  const [formSemester, setFormSemester] = useState("1");
  const [formType, setFormType] = useState<"END_SEMESTER" | "MID_TERM">("END_SEMESTER");
  const [formTitle, setFormTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      const [examsRes, programsRes] = await Promise.all([
        fetch("/api/admin/exams"),
        fetch("/api/programs"),
      ]);
      if (examsRes.ok) {
        const data = await examsRes.json();
        setExams(data.exams ?? []);
      }
      if (programsRes.ok) {
        const data = await programsRes.json();
        setPrograms(data.programs ?? []);
      }
    } catch {
      setError("Unable to load examinations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading state then fetches; this fetch-on-mount pattern is the desired behavior
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formProgramId) {
      setFormError("Choose a program");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: formProgramId,
          semester: Number(formSemester),
          type: formType,
          title: formTitle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Unable to create exam");
        return;
      }
      router.push(`/admin/exams/${data.exam.id}`);
    } catch {
      setFormError("Unable to create exam");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell title="Examinations" subtitle="Create and manage exam sessions" active="/admin/exams">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Exam Sessions</h2>
          <p className="text-sm text-muted-foreground">
            End-semester and mid-term exams, routines, mark entry and result publishing.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <IconPlus size={16} />
          New Exam
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <IconCertificate size={26} />
            </span>
            <div>
              <h3 className="text-base font-semibold">No exam sessions yet</h3>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Create your first exam to build a routine, collect marks and publish results.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <IconPlus size={16} />
              Create Exam
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {exams.map((exam) => {
            const badge = STATUS_BADGE[exam.status];
            return (
              <Link key={exam.id} href={`/admin/exams/${exam.id}`} className="block">
                <Card className="rounded-xl transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{exam.title}</h3>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {exam.program.name} · Semester {exam.semester} · {TYPE_LABEL[exam.type]}
                        {exam.academicYear ? ` · ${exam.academicYear.name}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>
                        {exam._count.subjects} subject{exam._count.subjects === 1 ? "" : "s"}
                      </div>
                      <div className="text-xs">
                        {exam._count.routine > 0
                          ? `${exam._count.routine} routine day${exam._count.routine === 1 ? "" : "s"}`
                          : "No routine yet"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {creating && (
        <AdminModal title="New Exam Session" onClose={() => setCreating(false)}>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="exam-title">Title</Label>
              <Input
                id="exam-title"
                placeholder="e.g. End-Semester Examination 2026"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Program</Label>
              <Select value={formProgramId} onValueChange={setFormProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Semester</Label>
                <Select value={formSemester} onValueChange={setFormSemester}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Semester {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={formType}
                  onValueChange={(v) => setFormType(v as "END_SEMESTER" | "MID_TERM")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="END_SEMESTER">End-Semester</SelectItem>
                    <SelectItem value="MID_TERM">Mid-Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              All subjects in this program + semester are added automatically with a default full
              marks (theory 100, practical 50).
            </p>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create & Open"}
              </Button>
            </div>
          </form>
        </AdminModal>
      )}
    </AdminShell>
  );
}