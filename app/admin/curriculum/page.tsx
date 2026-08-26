"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";

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
        router.replace("/");
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

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid var(--line)",
    borderRadius: "8px",
    background: "var(--input-bg)",
    color: "var(--input-color, inherit)",
    fontSize: "13px",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <AdminShell
      title="Curriculum"
      subtitle="Course Structure Management"
      active="/admin/curriculum"
    >
      <div style={{ display: "grid", gap: "20px" }}>
        {/* Program selector + actions */}
        <section
          style={{
            padding: "18px 20px",
            borderRadius: "12px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            alignItems: "flex-end",
          }}
        >
          <label style={{ display: "grid", gap: "6px", minWidth: "280px", flex: 1 }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
              Program
            </span>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              style={inputStyle}
              disabled={loading || programs.length === 0}
            >
              {programs.length === 0 && <option value="">No programs</option>}
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={addYear}
            style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
          >
            + Add Year
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loadingCurriculum}
            style={{
              ...inputStyle,
              width: "auto",
              cursor: saving ? "wait" : "pointer",
              background: "#0284c7",
              borderColor: "#0284c7",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {saving ? "Saving…" : hasCurriculum ? "Save Changes" : "Publish Curriculum"}
          </button>
        </section>

        {error && (
          <p className="admin-message error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="admin-message" role="status">
            {message}
          </p>
        )}

        {loadingCurriculum && <p className="cs-empty">Loading curriculum…</p>}

        {!loadingCurriculum && !hasCurriculum && !error && (
          <div className="cs-empty">
            <p>
              No curriculum published for this program yet. Add years,
              semesters and courses below, then click “Publish Curriculum”.
            </p>
          </div>
        )}

        {/* Years / semesters / courses editor */}
        {!loadingCurriculum &&
          draft.years.map((year, yi) => (
            <section
              key={`year-${yi}`}
              style={{
                padding: "18px 20px",
                borderRadius: "12px",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                display: "grid",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  value={year.label}
                  onChange={(e) => updateYearLabel(yi, e.target.value)}
                  placeholder="Year label"
                  style={{ ...inputStyle, fontWeight: 700 }}
                />
                <button
                  type="button"
                  onClick={() => removeYear(yi)}
                  title="Remove year"
                  style={{ ...inputStyle, width: "auto", whiteSpace: "nowrap", color: "#dc2626" }}
                >
                  Remove Year
                </button>
              </div>

              {year.semesters.map((sem, si) => {
                const totalCredits = sem.courses.reduce(
                  (sum, c) =>
                    sum + (Number.isFinite(c.credits) ? c.credits : 0),
                  0,
                );
                return (
                  <div
                    key={`sem-${yi}-${si}`}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      padding: "14px",
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        value={sem.label}
                        onChange={(e) => updateSemesterLabel(yi, si, e.target.value)}
                        placeholder="Semester label"
                        style={{ ...inputStyle, maxWidth: "260px", fontWeight: 700 }}
                      />
                      <small style={{ color: "var(--ink-soft)", fontSize: "12px" }}>
                        {sem.courses.length} courses · {totalCredits} cr
                      </small>
                      <span style={{ flex: 1 }} />
                      <button
                        type="button"
                        onClick={() => addCourse(yi, si)}
                        style={{ ...inputStyle, width: "auto", whiteSpace: "nowrap" }}
                      >
                        + Course
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSemester(yi, si)}
                        title="Remove semester"
                        style={{ ...inputStyle, width: "auto", whiteSpace: "nowrap", color: "#dc2626" }}
                      >
                        Remove Semester
                      </button>
                    </div>

                    {sem.courses.length > 0 && (
                      <div style={{ display: "grid", gap: "8px" }}>
                        {sem.courses.map((course, ci) => (
                          <div
                            key={`course-${yi}-${si}-${ci}`}
                            style={{ display: "flex", gap: "8px", alignItems: "center" }}
                          >
                            <input
                              value={course.code}
                              onChange={(e) =>
                                updateCourse(yi, si, ci, { code: e.target.value })
                              }
                              placeholder="Code (optional)"
                              style={{ ...inputStyle, maxWidth: "130px" }}
                            />
                            <input
                              value={course.name}
                              onChange={(e) =>
                                updateCourse(yi, si, ci, { name: e.target.value })
                              }
                              placeholder="Course name"
                              style={{ ...inputStyle, flex: 1 }}
                            />
                            <input
                              type="number"
                              min={0}
                              value={Number.isFinite(course.credits) ? course.credits : ""}
                              onChange={(e) =>
                                updateCourse(yi, si, ci, {
                                  credits: Number(e.target.value),
                                })
                              }
                              placeholder="Cr"
                              style={{ ...inputStyle, maxWidth: "80px" }}
                            />
                            <button
                              type="button"
                              onClick={() => removeCourse(yi, si, ci)}
                              title="Remove course"
                              style={{ ...inputStyle, width: "auto", color: "#dc2626" }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => addSemester(yi)}
                style={{ ...inputStyle, width: "auto", justifySelf: "start", cursor: "pointer" }}
              >
                + Add Semester
              </button>
            </section>
          ))}

        {/* Electives editor */}
        {!loadingCurriculum && (
          <section
            style={{
              padding: "18px 20px",
              borderRadius: "12px",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              display: "grid",
              gap: "14px",
            }}
          >
            <strong>Electives</strong>

            {(["ELECTIVE_I", "ELECTIVE_II"] as const).map((group) => {
              const items = draft.electives.filter((e) => e.group === group);
              return (
                <div key={group} style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <strong style={{ fontSize: "13px", color: "#0284c7" }}>
                      {group === "ELECTIVE_I" ? "Elective-I" : "Elective-II"}
                    </strong>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => addElective(group)}
                      style={{ ...inputStyle, width: "auto", cursor: "pointer" }}
                    >
                      + Elective
                    </button>
                  </div>

                  {items.map((item) => {
                    const realIndex = draft.electives.indexOf(item);
                    return (
                      <div
                        key={`${group}-${realIndex}`}
                        style={{ display: "flex", gap: "8px", alignItems: "center" }}
                      >
                        <input
                          value={item.code}
                          onChange={(e) =>
                            updateElective(realIndex, { code: e.target.value })
                          }
                          placeholder="Code"
                          style={{ ...inputStyle, maxWidth: "130px" }}
                        />
                        <input
                          value={item.name}
                          onChange={(e) =>
                            updateElective(realIndex, { name: e.target.value })
                          }
                          placeholder="Elective name"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <input
                          type="number"
                          min={0}
                          value={item.credits}
                          onChange={(e) =>
                            updateElective(realIndex, {
                              credits: Number(e.target.value),
                            })
                          }
                          style={{ ...inputStyle, maxWidth: "80px" }}
                        />
                        <button
                          type="button"
                          onClick={() => removeElective(realIndex)}
                          title="Remove elective"
                          style={{ ...inputStyle, width: "auto", color: "#dc2626" }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </AdminShell>
  );
}