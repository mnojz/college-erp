"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconLoader2,
  IconSchool,
  IconTrendingUp,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

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

  // Group active cohorts by degree program
  const cohortsByProgram = useMemo(() => {
    const map = new Map<
      string,
      {
        programId: string;
        programCode: string;
        programName: string;
        totalStudents: number;
        cohorts: Cohort[];
      }
    >();

    for (const c of cohorts) {
      if (!map.has(c.programId)) {
        map.set(c.programId, {
          programId: c.programId,
          programCode: c.programCode,
          programName: c.programName,
          totalStudents: 0,
          cohorts: [],
        });
      }
      const group = map.get(c.programId)!;
      group.cohorts.push(c);
      group.totalStudents += c.studentCount;
    }

    // Sort cohorts inside each program by semester ascending
    for (const group of map.values()) {
      group.cohorts.sort((a, b) => a.semester - b.semester);
    }

    return Array.from(map.values()).sort((a, b) => a.programCode.localeCompare(b.programCode));
  }, [cohorts]);

  async function openPreview(cohort: Cohort) {
    setBusy(true);
    setError("");
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
      toast.success(
        data.graduates
          ? `${data.moved} student(s) graduated from ${data.programCode}.`
          : `${data.moved} student(s) advanced: ${data.programCode} Semester ${data.fromSemester} → ${data.toSemester} (${data.academicYear}).`,
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
    <Card className="rounded-xl border border-border/70 shadow-xs">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <IconTrendingUp size={18} className="text-primary" />
              Cohort Progression &amp; Graduation
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Promote active student cohorts to the next semester or complete graduation for final-term students.
            </p>
          </div>

          {currentYear && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
              <IconCalendar size={13} className="text-primary" />
              <span>Current Term:</span>
              <span className="font-semibold text-foreground">{currentYear.name}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>
                <div className="grid gap-2">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : cohortsByProgram.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border/70 bg-muted/20 space-y-2">
            <IconUsers size={28} className="text-muted-foreground/50" />
            <p className="text-sm font-semibold text-foreground">No Active Cohorts Found</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              There are no enrolled students currently assigned to any active semester.
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {cohortsByProgram.map((group) => {
              const isGroupPreviewing = previewKey && previewKey.startsWith(`${group.programId}::`);

              return (
                <div
                  key={group.programId}
                  className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs transition-all"
                >
                  {/* Program Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 bg-muted/40 px-4 py-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <Badge className="font-mono text-xs font-bold bg-primary/15 text-primary border-0 px-2 py-0.5">
                        {group.programCode}
                      </Badge>
                      <h3 className="font-semibold text-sm text-foreground">
                        {group.programName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <IconUsers size={13} className="text-muted-foreground/70" />
                        <span>{group.totalStudents} total student{group.totalStudents === 1 ? "" : "s"}</span>
                      </span>
                      <span className="text-xs text-muted-foreground/60">•</span>
                      <span className="text-xs font-semibold text-foreground">
                        {group.cohorts.length} active cohort{group.cohorts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* Program Cohorts Grid */}
                  <div className="p-3.5 space-y-2.5">
                    {group.cohorts.map((c) => {
                      const itemKey = `${c.programId}::${c.semester}`;
                      const isItemPreviewing = previewKey === itemKey;

                      return (
                        <div
                          key={itemKey}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
                            isItemPreviewing
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/60 bg-background hover:bg-muted/30",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                            <Badge
                              className={cn(
                                "text-xs font-semibold border-0 px-2.5 py-0.5",
                                c.isFinalSemester
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : "bg-primary/15 text-primary",
                              )}
                            >
                              Semester {c.semester}
                            </Badge>

                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <IconUsers size={14} className="text-muted-foreground" />
                              <span>
                                {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                              </span>
                            </span>

                            {c.isFinalSemester && (
                              <Badge className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0">
                                Final Term · Graduation Ready
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant={c.isFinalSemester ? "default" : "outline"}
                              disabled={busy}
                              onClick={() => void openPreview(c)}
                              className={cn(
                                "h-8 text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs",
                                c.isFinalSemester
                                  ? "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500"
                                  : "",
                              )}
                            >
                              {c.isFinalSemester ? (
                                <>
                                  <IconSchool size={14} />
                                  <span>Graduate Cohort</span>
                                </>
                              ) : (
                                <>
                                  <span>Advance to Sem {c.semester + 1}</span>
                                  <IconArrowRight size={13} />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Active Confirmation Box for this Program */}
                    {isGroupPreviewing && preview && (
                      <div className="mt-3 rounded-xl border border-primary/40 bg-card p-4 space-y-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                              {preview.graduates ? (
                                <>
                                  <IconSchool size={16} className="text-amber-600 dark:text-amber-400" />
                                  <span>Confirm Graduation: {preview.students.length} Students</span>
                                </>
                              ) : (
                                <>
                                  <IconTrendingUp size={16} className="text-primary" />
                                  <span>
                                    Confirm Promotion: Semester {preview.fromSemester} → Semester {preview.toSemester}
                                  </span>
                                </>
                              )}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {preview.graduates
                                ? `These students from ${preview.programCode} will have their graduation completed and recorded.`
                                : `These ${preview.students.length} students from ${preview.programCode} will be promoted to the next semester.`}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setPreview(null);
                              setPreviewKey(null);
                              setConfirmText("");
                            }}
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <IconX size={15} />
                          </Button>
                        </div>

                        {/* Student roster preview */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Roster to be advanced ({preview.students.length} students):
                          </span>
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-xs text-foreground">
                              {preview.students.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center gap-1.5 truncate rounded-md bg-background/80 px-2 py-1 border border-border/40"
                                >
                                  <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                                    {s.enrollmentNumber}
                                  </span>
                                  <span className="truncate font-medium">
                                    {s.firstName} {s.lastName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Safety confirmation input */}
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
                          <div className="space-y-1.5">
                            <Label htmlFor="progression-confirm" className="text-xs text-muted-foreground">
                              Type <strong className="font-bold text-foreground font-mono">{preview.programCode}</strong> to confirm:
                            </Label>
                            <Input
                              id="progression-confirm"
                              type="text"
                              autoComplete="off"
                              placeholder={preview.programCode}
                              value={confirmText}
                              disabled={busy}
                              onChange={(e) => setConfirmText(e.target.value)}
                              className="w-full sm:w-48 h-8.5 font-mono text-xs uppercase"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
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
                              className="h-8.5 text-xs"
                            >
                              Cancel
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                busy ||
                                confirmText.trim().toUpperCase() !== preview.programCode.toUpperCase()
                              }
                              onClick={() => void confirmAdvance()}
                              className={cn(
                                "h-8.5 text-xs font-semibold gap-1.5",
                                preview.graduates
                                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                                  : "",
                              )}
                            >
                              {busy ? (
                                <>
                                  <IconLoader2 size={13} className="animate-spin" />
                                  <span>Processing…</span>
                                </>
                              ) : (
                                <>
                                  <IconCheck size={14} />
                                  <span>
                                    {preview.graduates ? "Confirm Graduation" : "Confirm Promotion"}
                                  </span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
