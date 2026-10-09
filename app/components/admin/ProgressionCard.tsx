"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Cohort = {
  programId: string;
  programCode: string;
  programName: string;
  semester: number;
  studentCount: number;
  isFinalSemester: boolean;
};

type CohortPreview = {
  programCode: string;
  fromSemester: number;
  toSemester: number | null;
  graduates: boolean;
  students: Array<{
    id: string;
    enrollmentNumber: string;
    firstName: string;
    lastName: string;
  }>;
};

export function ProgressionCard() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [currentYear, setCurrentYear] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<CohortPreview | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  /**
   * Type-to-confirm: promotion/graduation is irreversible append-only history,
   * so the Confirm button stays disabled until the admin types the program
   * code. Guards against a stray double-click advancing a whole cohort.
   */
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/progression/cohorts");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to load cohorts");
        return;
      }
      setCohorts(data.cohorts ?? []);
      setCurrentYear(data.currentYear ?? null);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sync = setTimeout(() => void load(), 0);
    return () => clearTimeout(sync);
  }, [load]);


  async function openPreview(cohort: Cohort) {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    setConfirmText("");
    try {
      const res = await fetch(
        `/api/progression/cohorts?programId=${cohort.programId}&fromSemester=${cohort.semester}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to preview cohort");
        return;
      }
      setPreview(data.preview);
      setPreviewKey(`${cohort.programId}::${cohort.semester}`);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAdvance() {
    if (!previewKey) return;
    const [programId, fromSemester] = previewKey.split("::");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/progression/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, fromSemester: Number(fromSemester) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to advance cohort");
        return;
      }
      setMessage(
        data.graduates
          ? `${data.moved} graduated from ${data.programCode}.`
          : `${data.moved} advanced: ${data.programCode} ${data.fromSemester} → ${data.toSemester} (${data.academicYear}).`,
      );
      setPreview(null);
      setPreviewKey(null);
      setConfirmText("");
      setLoading(true);
      await load();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setBusy(false);
    }
  }


  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="text-base">Semester Progression</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="m-0 text-sm text-muted-foreground">Loading cohorts…</p>
        ) : (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-muted-foreground">
              Active batches per program — promote each cohort when ready.{" "}
              {currentYear ? (
                <>History rows attach to <strong className="font-medium text-foreground">{currentYear.name}</strong>.</>
              ) : (
                <strong className="font-medium text-destructive">No current academic year — advancing is disabled.</strong>
              )}
            </p>

            {cohorts.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                No active cohorts. Admit a new batch below to get started.
              </p>
            ) : (
              <div className="grid gap-2">
                {cohorts.map((c) => (
                  <div
                    key={`${c.programId}::${c.semester}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <Badge variant="secondary">
                      {c.programCode} · Sem {c.semester}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                      {c.isFinalSemester ? " · final semester" : ""}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      disabled={busy || !currentYear}
                      onClick={() => void openPreview(c)}
                    >
                      {c.isFinalSemester ? "Graduate" : `Promote to Sem ${c.semester + 1}`}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {preview && (
              <div className="grid gap-2 rounded-lg border border-dashed p-3">
                <p className="m-0 text-sm font-medium">
                  {preview.graduates
                    ? `Graduate ${preview.students.length} from ${preview.programCode}?`
                    : `Promote ${preview.students.length}: ${preview.programCode} ${preview.fromSemester} → ${preview.toSemester}?`}
                </p>
                <ul className="m-0 grid max-h-44 gap-1 overflow-y-auto p-0 text-sm text-muted-foreground">
                  {preview.students.map((s) => (
                    <li key={s.id} className="list-none">
                      {s.enrollmentNumber} · {s.firstName} {s.lastName}
                    </li>
                  ))}
                </ul>
                <div className="grid gap-1.5">
                  <Label htmlFor="progression-confirm" className="text-[13px] text-muted-foreground">
                    This is permanent and cannot be undone. Type{" "}
                    <strong className="font-medium text-foreground">{preview.programCode}</strong> to
                    enable the {preview.graduates ? "graduation" : "promotion"} button.
                  </Label>
                  <Input
                    id="progression-confirm"
                    type="text"
                    autoComplete="off"
                    placeholder={preview.programCode}
                    value={confirmText}
                    disabled={busy}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="sm:w-56"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || confirmText.trim().toUpperCase() !== preview.programCode.toUpperCase()}
                    onClick={() => void confirmAdvance()}
                  >
                    {busy ? "Working…" : preview.graduates ? "Confirm graduation" : "Confirm promotion"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setPreview(null);
                      setPreviewKey(null);
                      setConfirmText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            {message && !error && <p className="m-0 text-[13px] text-[var(--ctp-green)]">{message}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
