"use client";

import { useEffect, useRef, useState } from "react";
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
import { IconCloudUpload, IconX } from "@tabler/icons-react";

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
  const [message, setMessage] = useState("");
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
    setMessage("");
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
    setMessage("");
    const data = await validateOnServer(rows, false);
    if (!data) return;
    if (!data.ok) {
      setProblems(data.problems ?? [data.error ?? "Unable to admit batch"]);
      setPreview(null);
      return;
    }
    setMessage(
      `${(data as { created?: number }).created ?? preview?.count ?? 0} admitted to ${preview?.programCode ?? ""} semester ${semester}. Default password: student1234.`,
    );
    resetFile();
  }


  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="text-base">Bulk Intake — New Batch</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            Upload the entrance-system JSON export. Each entry needs an enrollment
            number, registration ID, name and email (roll optional).
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Program</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Semester</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {semesterOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Semester {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="intake-date">Admission date</Label>
              <Input
                id="intake-date"
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="intake-file">Student data file</Label>
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
              className={
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors " +
                (dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/60 hover:bg-muted/40") +
                (busy ? " pointer-events-none opacity-60" : "")
              }
            >
              <IconCloudUpload
                size={26}
                aria-hidden="true"
                className={dragging ? "text-primary" : "text-muted-foreground"}
              />
              {fileName ? (
                <p className="m-0 text-sm font-medium text-foreground">{fileName}</p>
              ) : (
                <>
                  <p className="m-0 text-sm font-medium text-foreground">
                    Drag &amp; drop the JSON file here, or click to browse
                  </p>
                  <p className="m-0 text-xs text-muted-foreground">Accepts .json exports</p>
                </>
              )}
              {fileName && !busy && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Remove selected file"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetFile();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      resetFile();
                    }
                  }}
                  className="mt-0.5 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  <IconX size={13} aria-hidden="true" />
                  Remove
                </span>
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

          {problems.length > 0 && (
            <ul className="m-0 grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-destructive/40 p-3 text-[13px] text-destructive">
              {problems.map((p, i) => (
                <li key={i} className="list-none">{p}</li>
              ))}
            </ul>
          )}

          {preview && problems.length === 0 && (
            <div className="grid gap-2">
              <p className="m-0 text-sm font-medium">
                {preview.count} students → {preview.programCode} semester {preview.semester} ({fileName})
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Roll</th>
                      <th className="px-2 py-1.5 text-left font-medium">Name</th>
                      <th className="px-2 py-1.5 text-left font-medium">Enrollment</th>
                      <th className="px-2 py-1.5 text-left font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.students.map((s) => (
                      <tr key={s.enrollmentNumber} className="border-t">
                        <td className="px-2 py-1.5">{s.rollNumber ?? "—"}</td>
                        <td className="px-2 py-1.5">{s.firstName} {s.lastName}</td>
                        <td className="px-2 py-1.5">{s.enrollmentNumber}</td>
                        <td className="px-2 py-1.5">{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => void confirmIntake()}>
                  {busy ? "Admitting…" : `Confirm — admit ${preview.count}`}
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={resetFile}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
          {message && !error && <p className="m-0 text-[13px] text-[var(--ctp-green)]">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
