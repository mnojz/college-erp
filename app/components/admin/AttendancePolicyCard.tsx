"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AcademicYear = {
  id: string;
  name: string;
  isCurrent: boolean;
  minAttendancePercent: number;
};

/**
 * Exam-eligibility threshold for the current academic year. Students see this
 * on their attendance page, where it used to be a hardcoded 75%.
 */
export function AttendancePolicyCard() {
  const [year, setYear] = useState<AcademicYear | null>(null);
  const [value, setValue] = useState("75");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/academic-years?pageSize=50");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to load academic years");
        return;
      }
      const years: AcademicYear[] = data.academicYears ?? [];
      const current = years.find((y) => y.isCurrent) ?? years[0] ?? null;
      setYear(current);
      if (current) setValue(String(current.minAttendancePercent ?? 75));
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

  async function save() {
    if (!year) return;
    const percent = Number(value);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      setError("Enter a whole number between 0 and 100");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/academic-years", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: year.id, minAttendancePercent: percent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to save the policy");
        return;
      }
      setYear(data.academicYear);
      setValue(String(data.academicYear.minAttendancePercent));
      setMessage(`Exam eligibility for ${data.academicYear.name} is now ${data.academicYear.minAttendancePercent}%.`);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="text-base">Attendance Policy</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="m-0 text-sm text-muted-foreground">Loading policy…</p>
        ) : !year ? (
          <p className="m-0 text-sm text-muted-foreground">
            No academic year exists yet, so there is no policy to configure. Students will fall back
            to 75% until one is created.
          </p>
        ) : (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-muted-foreground">
              Minimum attendance a student needs in{" "}
              <strong className="font-medium text-foreground">{year.name}</strong> to be eligible
              for examinations. Shown on the student attendance page.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid w-40 gap-1.5">
                <Label htmlFor="min-attendance">Required attendance (%)</Label>
                <Input
                  id="min-attendance"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={saving}
                />
              </div>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save Policy"}
              </Button>
            </div>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            {message && !error && <p className="m-0 text-[13px] text-[var(--ctp-green)]">{message}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
