"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { IconLoader2, IconPlus, IconTrash, IconX } from "@tabler/icons-react";

type Program = {
  id: string;
  name: string;
  code: string;
  durationYears: number;
  departmentName: string;
};

type DraftCourse = { code: string; name: string; credits: number };
type DraftSemester = { label: string; courses: DraftCourse[] };
type DraftYear = { label: string; semesters: DraftSemester[] };
type DraftElective = {
  group: "ELECTIVE_I" | "ELECTIVE_II";
  code: string;
  name: string;
  credits: number;
};

type Draft = { years: DraftYear[]; electives: DraftElective[] };

const emptyDraft: Draft = { years: [], electives: [] };

export default function AdminCurriculumPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hasCurriculum, setHasCurriculum] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok || (await me.json()).user.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }
      const res = await fetch("/api/programs");
      const data = await res.json();
      const loaded: Program[] = data.programs ?? [];
      setPrograms(loaded);
      if (loaded.length > 0) setProgramId(loaded[0].id);
      setLoading(false);
    }
    load().catch(() => {
      setError("Unable to load programs");
      setLoading(false);
    });
  }, [router]);

  const loadCurriculum = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingCurriculum(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/curriculum?programId=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load curriculum");
      if (!data.curriculum) {
        setDraft(emptyDraft);
        setHasCurriculum(false);
        return;
      }
      setHasCurriculum(true);
      setDraft({
        years: (data.curriculum.years ?? []).map(
          (y: {
            label: string;
            semesters: Array<{
              label: string;
              courses: Array<{
                code: string | null;
                name: string;
                credits: number;
              }>;
            }>;
          }) => ({
            label: y.label,
            semesters: (y.semesters ?? []).map((s) => ({
              label: s.label,
              courses: (s.courses ?? []).map((c) => ({
                code: c.code ?? "",
                name: c.name,
                credits: c.credits,
              })),
            })),
          }),
        ),
        electives: (data.curriculum.electives ?? []).map(
          (e: {
            group: string;
            code: string | null;
            name: string;
            credits: number;
          }) => ({
            group: e.group as DraftElective["group"],
            code: e.code ?? "",
            name: e.name,
            credits: e.credits,
          }),
        ),
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load curriculum",
      );
    } finally {
      setLoadingCurriculum(false);
    }
  }, []);

  useEffect(() => {
    if (programId) void loadCurriculum(programId);
  }, [programId, loadCurriculum]);

  // ─── Mutators ────────────────────────────────────────────────────
  function addYear() {
    setDraft((d) => ({
      ...d,
      years: [
        ...d.years,
        {
          label: `Year ${d.years.length + 1}`,
          semesters: [
            { label: `Semester ${d.years.length * 2 + 1}`, courses: [] },
          ],
        },
      ],
    }));
  }

  function removeYear(index: number) {
    setDraft((d) => ({ ...d, years: d.years.filter((_, i) => i !== index) }));
  }

  function updateYearLabel(index: number, label: string) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, i) => (i === index ? { ...y, label } : y)),
    }));
  }

  function addSemester(yearIndex: number) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: [
                ...y.semesters,
                {
                  label: `Semester ${
                    d.years
                      .slice(0, yearIndex)
                      .reduce((n, yy) => n + yy.semesters.length, 0) +
                    y.semesters.length +
                    1
                  }`,
                  courses: [],
                },
              ],
            }
          : y,
      ),
    }));
  }

  function removeSemester(yearIndex: number, semIndex: number) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? { ...y, semesters: y.semesters.filter((_, si) => si !== semIndex) }
          : y,
      ),
    }));
  }

  function updateSemesterLabel(
    yearIndex: number,
    semIndex: number,
    label: string,
  ) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex ? { ...s, label } : s,
              ),
            }
          : y,
      ),
    }));
  }

  function addCourse(yearIndex: number, semIndex: number) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex
                  ? {
                      ...s,
                      courses: [...s.courses, { code: "", name: "", credits: 3 }],
                    }
                  : s,
              ),
            }
          : y,
      ),
    }));
  }

  function removeCourse(
    yearIndex: number,
    semIndex: number,
    courseIndex: number,
  ) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex
                  ? {
                      ...s,
                      courses: s.courses.filter((_, ci) => ci !== courseIndex),
                    }
                  : s,
              ),
            }
          : y,
      ),
    }));
  }

  function updateCourse(
    yearIndex: number,
    semIndex: number,
    courseIndex: number,
    patch: Partial<DraftCourse>,
  ) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex
                  ? {
                      ...s,
                      courses: s.courses.map((c, ci) =>
                        ci === courseIndex ? { ...c, ...patch } : c,
                      ),
                    }
                  : s,
              ),
            }
          : y,
      ),
    }));
  }

  function addElective(group: DraftElective["group"]) {
    setDraft((d) => ({
      ...d,
      electives: [...d.electives, { group, code: "", name: "", credits: 3 }],
    }));
  }

  function removeElective(index: number) {
    setDraft((d) => ({
      ...d,
      electives: d.electives.filter((_, i) => i !== index),
    }));
  }

  function updateElective(index: number, patch: Partial<DraftElective>) {
    setDraft((d) => ({
      ...d,
      electives: d.electives.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
  }

  // ─── Save ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!programId) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/curriculum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          years: draft.years,
          electives: draft.electives,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to save curriculum");
        return;
      }
      setHasCurriculum(true);
      setMessage("Curriculum saved successfully.");
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Curriculum"
      subtitle="Course Structure Management"
      active="/admin/curriculum"
    >
      <div className="flex flex-col gap-5">
        {/* Program selector + actions */}
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="grid min-w-0 flex-1 gap-1.5 sm:min-w-64">
              <Label htmlFor="curriculum-program">Program</Label>
              <Select
                value={programId}
                onValueChange={setProgramId}
                disabled={loading || programs.length === 0}
              >
                <SelectTrigger id="curriculum-program" className="w-full">
                  <SelectValue
                    placeholder={programs.length === 0 ? "No programs" : "Select a program"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addYear}
              className="w-full sm:w-auto"
            >
              <IconPlus size={16} aria-hidden="true" />
              Add Year
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || loadingCurriculum}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <IconLoader2 size={16} className="animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : hasCurriculum ? (
                "Save Changes"
              ) : (
                "Publish Curriculum"
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400" role="status">
            {message}
          </p>
        )}

        {loadingCurriculum && (
          <div className="rounded-xl border border-dashed px-8 py-10 text-center text-sm text-muted-foreground">
            <IconLoader2 size={20} className="mx-auto mb-2 animate-spin" aria-hidden="true" />
            Loading curriculum…
          </div>
        )}

        {!loadingCurriculum && !hasCurriculum && !error && (
          <div className="rounded-xl border border-dashed px-8 py-10 text-center text-sm text-muted-foreground">
            <p>
              No curriculum published for this program yet. Add years,
              semesters and courses below, then click “Publish Curriculum”.
            </p>
          </div>
        )}

        {/* Years / semesters / courses editor */}
        {!loadingCurriculum &&
          draft.years.map((year, yi) => (
            <Card key={`year-${yi}`}>
              <CardHeader className="border-b">
                <Input
                  value={year.label}
                  onChange={(e) => updateYearLabel(yi, e.target.value)}
                  aria-label="Year label"
                  placeholder="Year label"
                  className="font-semibold"
                />
                <CardAction>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Remove year"
                    onClick={() => removeYear(yi)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <IconTrash size={16} aria-hidden="true" />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {year.semesters.map((sem, si) => {
                  const totalCredits = sem.courses.reduce(
                    (sum, c) =>
                      sum + (Number.isFinite(c.credits) ? c.credits : 0),
                    0,
                  );
                  return (
                    <div
                      key={`sem-${yi}-${si}`}
                      className="overflow-hidden rounded-lg border"
                    >
                      <div className="flex flex-col gap-2.5 border-b bg-muted/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <Input
                          value={sem.label}
                          onChange={(e) => updateSemesterLabel(yi, si, e.target.value)}
                          placeholder="Semester label"
                          aria-label="Semester label"
                          className="font-semibold sm:max-w-56"
                        />
                        <Badge variant="secondary" className="w-fit">
                          {sem.courses.length} courses · {totalCredits} cr
                        </Badge>
                        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addCourse(yi, si)}
                          >
                            <IconPlus size={15} aria-hidden="true" />
                            Course
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remove semester"
                            onClick={() => removeSemester(yi, si)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <IconTrash size={16} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                    <div className="flex flex-col gap-2.5 p-3">
                        {sem.courses.length === 0 ? (
                          <p className="py-2 text-center text-xs text-muted-foreground">
                            No courses yet — use “Course” to add one.
                          </p>
                        ) : (
                          sem.courses.map((course, ci) => (
                            <div
                              key={`course-${yi}-${si}-${ci}`}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center"
                            >
                              <Input
                                value={course.code}
                                onChange={(e) =>
                                  updateCourse(yi, si, ci, { code: e.target.value })
                                }
                                placeholder="Code (optional)"
                                aria-label="Course code"
                                className="sm:max-w-36"
                              />
                              <Input
                                value={course.name}
                                onChange={(e) =>
                                  updateCourse(yi, si, ci, { name: e.target.value })
                                }
                                placeholder="Course name"
                                aria-label="Course name"
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                min={0}
                                value={Number.isFinite(course.credits) ? course.credits : ""}
                                onChange={(e) =>
                                  updateCourse(yi, si, ci, {
                                    credits: Number(e.target.value),
                                  })
                                }
                                placeholder="Cr"
                                aria-label="Credits"
                                className="sm:max-w-24"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Remove course"
                                onClick={() => removeCourse(yi, si, ci)}
                                className="shrink-0 self-end text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto"
                              >
                                <IconX size={16} aria-hidden="true" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}

              <Button
                  type="button"
                  variant="outline"
                  onClick={() => addSemester(yi)}
                  className="w-full sm:w-auto sm:self-start"
                >
                  <IconPlus size={15} aria-hidden="true" />
                  Add Semester
                </Button>
              </CardContent>
            </Card>
          ))}

        {/* Electives editor */}
        {!loadingCurriculum && (
          <Card>
            <CardHeader>
              <CardTitle>Electives</CardTitle>
              <CardDescription>
                Open elective courses offered alongside the core curriculum.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {(["ELECTIVE_I", "ELECTIVE_II"] as const).map((group) => {
                const items = draft.electives.filter((e) => e.group === group);
                return (
                  <div key={group} className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">
                        {group === "ELECTIVE_I" ? "Elective I" : "Elective II"}
                      </h4>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => addElective(group)}
                      >
                        <IconPlus size={15} aria-hidden="true" />
                        Add Elective
                      </Button>
                    </div>

                    {items.length === 0 ? (
                      <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                        No electives added yet.
                      </p>
                    ) : (
                      items.map((item) => {
                        const realIndex = draft.electives.indexOf(item);
                        return (
                          <div
                            key={`${group}-${realIndex}`}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          >
                            <Input
                              value={item.code}
                              onChange={(e) =>
                                updateElective(realIndex, { code: e.target.value })
                              }
                              placeholder="Code"
                              aria-label={`${group} code`}
                              className="sm:max-w-36"
                            />
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                updateElective(realIndex, { name: e.target.value })
                              }
                              placeholder="Elective name"
                              aria-label={`${group} name`}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={item.credits}
                              onChange={(e) =>
                                updateElective(realIndex, {
                                  credits: Number(e.target.value),
                                })
                              }
                              placeholder="Cr"
                              aria-label={`${group} credits`}
                              className="sm:max-w-24"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Remove elective"
                              onClick={() => removeElective(realIndex)}
                              className="shrink-0 self-end text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto"
                            >
                              <IconX size={16} aria-hidden="true" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}