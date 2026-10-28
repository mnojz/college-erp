"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconAlertCircle,
  IconCheck,
  IconCloudUpload,
  IconDownload,
  IconFileText,
  IconLoader2,
  IconUserPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type IntakePreviewStudent = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  firstName: string;
  lastName: string;
  email: string;
};

type IntakePreview = {
  programCode: string;
  semester: number;
  count: number;
  students: IntakePreviewStudent[];
};

type ProgramOption = { id: string; code: string; name: string; durationYears: number };

export function BulkIntakeCard() {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programId, setProgramId] = useState("");
  const [semester, setSemester] = useState("1");
  const [admissionDate, setAdmissionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [preview, setPreview] = useState<IntakePreview | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  /** Drag-over highlight for the drop-zone; cleared on drag-leave/drop. */
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/programs");
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const list = (data.programs ?? []) as ProgramOption[];
        setPrograms(list);
        if (list.length > 0) setProgramId((prev) => prev || list[0].id);
      } catch {
        /* programs simply stay empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const semesterOptions = (() => {
    const p = programs.find((x) => x.id === programId);
    const total = (p?.durationYears ?? 4) * 2;
    return Array.from({ length: total }, (_, i) => i + 1);
  })();

  function resetFile() {
    setRows(null);
    setPreview(null);
    setProblems([]);
    setFileName("");
    setDragging(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function validateOnServer(payload: unknown[], dryRun: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/progression/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          semester: Number(semester),
          admissionDate,
          dryRun,
          rows: payload,
        }),
      });
      const data = await res.json();
      return data as { ok: boolean; preview?: IntakePreview; problems?: string[]; error?: string };
    } catch {
      setError("Unable to reach the server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setPreview(null);
    setProblems([]);
    setFileName(file.name);
    if (!programId) {
      setProblems(["Select a program first"]);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      setRows(list);
      const data = await validateOnServer(list, true);
      if (!data) return;
      if (!data.ok) {
        setProblems(data.problems ?? [data.error ?? "Unable to validate file"]);
        setPreview(null);
        return;
      }
      setProblems([]);
      setPreview(data.preview ?? null);
    } catch {
      setProblems(["File is not valid JSON"]);
      setRows(null);
    }
  }

  async function confirmIntake() {
    if (!rows || !programId) return;
    setError("");
    const data = await validateOnServer(rows, false);
    if (!data) return;
    if (!data.ok) {
      setProblems(data.problems ?? [data.error ?? "Unable to admit batch"]);
      setPreview(null);
      return;
    }
    toast.success(
      `${(data as { created?: number }).created ?? preview?.count ?? 0} admitted to ${preview?.programCode ?? ""} semester ${semester}. Default password: student1234.`,
    );
    resetFile();
  }

  function downloadSampleJson() {
    const sample = [
      {
        enrollmentNumber: "079BCT001",
        registrationId: "FWU-2026-001",
        rollNumber: 1,
        firstName: "Aarav",
        lastName: "Sharma",
        email: "aarav.sharma@example.edu.np",
      },
      {
        enrollmentNumber: "079BCT002",
        registrationId: "FWU-2026-002",
        rollNumber: 2,
        firstName: "Bikash",
        lastName: "Thapa",
        email: "bikash.thapa@example.edu.np",
      },
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_student_intake.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Sample JSON template downloaded.");
  }

  return (
    <Card className="rounded-xl border border-border/70 shadow-xs">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <IconUserPlus size={18} className="text-primary" />
              Batch Student Intake &amp; Enrollment
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Configure target cohort parameters on the left and upload your student roster file on the right.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadSampleJson}
            className="gap-1.5 text-xs font-semibold h-8.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <IconDownload size={14} className="text-primary" />
            <span>Sample JSON Template</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* Horizontal Layout: Left Controls + Right Dropzone */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          {/* Left Column: Dropdowns & Configuration (5 cols) */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Degree Program</Label>
                <Select value={programId} onValueChange={setProgramId}>
                  <SelectTrigger className="w-full h-9 text-xs font-medium">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <span className="font-bold">{p.code}</span> — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Intake Semester</Label>
                  <Select value={semester} onValueChange={setSemester}>
                    <SelectTrigger className="w-full h-9 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {semesterOptions.map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-xs">
                          Semester {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="intake-date" className="text-xs font-semibold text-foreground">
                    Admission Date
                  </Label>
                  <Input
                    id="intake-date"
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
              <p>• Automatically sets active status &amp; creates student login credentials.</p>
              <p>• Default initial password for all enrolled students: <code className="font-mono font-semibold text-foreground">student1234</code></p>
            </div>
          </div>

          {/* Right Column: Drag & Drop Zone (7 cols) */}
          <div className="md:col-span-7 flex flex-col justify-center">
            <div
              role="button"
              tabIndex={0}
              aria-disabled={busy}
              onClick={() => !busy && fileRef.current?.click()}
              onKeyDown={(e) => {
                if (busy) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!busy) void handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "h-full min-h-[175px] flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-all",
                dragging
                  ? "border-primary bg-primary/10 scale-[1.01]"
                  : "border-border/80 bg-muted/10 hover:border-primary/60 hover:bg-muted/30",
                busy ? "pointer-events-none opacity-60" : "",
              )}
            >
              <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {fileName ? (
                  <IconFileText size={22} className="text-primary" />
                ) : (
                  <IconCloudUpload
                    size={22}
                    className={cn(dragging ? "text-primary animate-bounce" : "text-primary")}
                  />
                )}
              </div>

              {fileName ? (
                <div className="space-y-1">
                  <p className="m-0 text-sm font-semibold text-foreground">{fileName}</p>
                  <p className="m-0 text-xs text-muted-foreground">Click or drop another file to replace</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="m-0 text-xs sm:text-sm font-semibold text-foreground">
                    Drag &amp; drop student JSON roster here, or <span className="text-primary underline">browse</span>
                  </p>
                  <p className="m-0 text-[11px] text-muted-foreground">
                    Accepts a standard <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">.json</code> array containing enrollment numbers, names &amp; emails
                  </p>
                </div>
              )}

              {fileName && !busy && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetFile();
                  }}
                  className="mt-1 h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 px-2.5"
                >
                  <IconX size={13} aria-hidden="true" />
                  Remove selected file
                </Button>
              )}

              <Input
                id="intake-file"
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                disabled={busy}
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>

        {/* Validation Errors Banner */}
        {problems.length > 0 && (
          <div className="rounded-xl bg-destructive/15 p-4 text-xs font-medium text-destructive space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <IconAlertCircle size={15} className="shrink-0" />
              <span>Validation failed for the uploaded student data:</span>
            </div>
            <ul className="m-0 list-disc list-inside space-y-1 pl-1">
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Student Roster Preview Table */}
        {preview && problems.length === 0 && (
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <IconUsers size={16} className="text-primary" />
                  <span>
                    Ready to Admit: {preview.count} Students into {preview.programCode} (Semester {preview.semester})
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Source file: <span className="font-semibold text-foreground">{fileName}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={resetFile}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void confirmIntake()}
                  className="h-8 text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs"
                >
                  {busy ? (
                    <>
                      <IconLoader2 size={13} className="animate-spin" />
                      <span>Admitting Students…</span>
                    </>
                  ) : (
                    <>
                      <IconCheck size={14} />
                      <span>Confirm &amp; Admit {preview.count} Students</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs text-foreground font-semibold">
                  <tr className="border-b border-border/60">
                    <th className="px-3 py-2 text-left w-16">Roll</th>
                    <th className="px-3 py-2 text-left">Full Name</th>
                    <th className="px-3 py-2 text-left">Enrollment No.</th>
                    <th className="px-3 py-2 text-left">Registration ID</th>
                    <th className="px-3 py-2 text-left">Institutional Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-background">
                  {preview.students.map((s) => (
                    <tr key={s.enrollmentNumber} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.rollNumber ?? "—"}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">{s.firstName} {s.lastName}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.enrollmentNumber}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.registrationId}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <p className="m-0 rounded-lg bg-destructive/15 p-3 text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
