"use client";

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { gradeForMarks } from "@/app/lib/grading";

type Student = {
  id: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  user: { firstName: string; lastName: string };
};

type ClassItem = {
  id: string;
  subjectId: string;
  programId: string;
  semester: number;
  subject: { code: string; name: string };
  program: { name: string; code: string; students: Student[] };
};

type AssessmentItem = {
  id: string;
  name: string;
  maxMarks: number | string;
  assessmentDate: string | null;
  subjectId: string;
  programId: string;
  semester: number;
  subject: { code: string; name: string };
  program: { code: string; name: string };
  _count?: { results: number };
};

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
};

type Banner = { kind: "success" | "error"; text: string } | null;
type ModalState = { kind: "create" } | { kind: "edit"; assessment: AssessmentItem } | null;

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid var(--line, #e2e8f0)",
  background: "var(--panel, #fff)",
  color: "inherit",
  fontSize: "0.9rem",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "0.8rem",
  color: "var(--ink-soft)",
  fontWeight: "600",
};

const thStyle: CSSProperties = { padding: "10px 14px", fontWeight: "600", fontSize: "0.78rem" };
const tdStyle: CSSProperties = { padding: "10px 14px", verticalAlign: "middle" };

const iconBtnStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  border: "1px solid var(--line, #e2e8f0)",
  background: "transparent",
  cursor: "pointer",
  color: "var(--ink-soft)",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TeacherAssessmentsPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);

  // Create / edit modal
  const [modal, setModal] = useState<ModalState>(null);
  const [formClassId, setFormClassId] = useState("");
  const [formName, setFormName] = useState("");
  const [formMaxMarks, setFormMaxMarks] = useState("100");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState("");
  const [isSavingAssessment, setIsSavingAssessment] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AssessmentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Marks entry panel
  const [openMarksId, setOpenMarksId] = useState<string | null>(null);
  const [marksLoading, setMarksLoading] = useState(false);
  const [marksState, setMarksState] = useState<Record<string, string>>({});
  const [isSubmittingMarks, setIsSubmittingMarks] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [classesRes, assessmentsRes, profRes] = await Promise.all([
          fetch("/api/attendance"),
          fetch("/api/assessments"),
          fetch("/api/teacher/profile"),
        ]);

        if (
          [classesRes, assessmentsRes, profRes].some((r) => r.status === 401 || r.status === 403)
        ) {
          router.replace("/dashboard");
          return;
        }

        const classesData = await classesRes.json();
        const assessmentsData = await assessmentsRes.json();
        const profData = await profRes.json();

        setClasses(classesData.classes ?? []);
        setAssessments(assessmentsData.assessments ?? []);
        if (profRes.ok && profData.teacher) {
          setTeacherInfo({
            firstName: profData.teacher.user.firstName,
            lastName: profData.teacher.user.lastName,
            employeeNo: profData.teacher.employeeNo,
            profileImageUrl: profData.teacher.profileImageUrl,
          });
        }
      } catch {
        setBanner({ kind: "error", text: "Unable to load teaching and assessment records" });
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  async function refreshAssessments(): Promise<AssessmentItem[]> {
    const res = await fetch("/api/assessments");
    if (!res.ok) throw new Error("Unable to refresh assessments");
    const data = await res.json();
    const list: AssessmentItem[] = data.assessments ?? [];
    setAssessments(list);
    return list;
  }

  /** Active students of the assessment's class (deduped across parallel slots). */
  function rosterFor(a: AssessmentItem): Student[] {
    const sameSemester = classes.filter(
      (c) => c.programId === a.programId && c.semester === a.semester,
    );
    const pool =
      sameSemester.length > 0 ? sameSemester : classes.filter((c) => c.programId === a.programId);
    const byId = new Map<string, Student>();
    for (const c of pool) for (const s of c.program.students) byId.set(s.id, s);
    return [...byId.values()].sort((x, y) => {
      const rx = Number(x.rollNumber);
      const ry = Number(y.rollNumber);
      if (Number.isFinite(rx) && Number.isFinite(ry)) return rx - ry;
      return x.enrollmentNumber.localeCompare(y.enrollmentNumber);
    });
  }

  const filledCount = useMemo(
    () => Object.values(marksState).filter((v) => v.trim() !== "").length,
    [marksState],
  );

  function openCreate() {
    setModal({ kind: "create" });
    setFormClassId(classes[0]?.id ?? "");
    setFormName("");
    setFormMaxMarks("100");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormError("");
  }

  function openEdit(a: AssessmentItem) {
    const match =
      classes.find(
        (c) =>
          c.subjectId === a.subjectId && c.programId === a.programId && c.semester === a.semester,
      ) ?? classes.find((c) => c.subjectId === a.subjectId);
    setModal({ kind: "edit", assessment: a });
    setFormClassId(match?.id ?? "");
    setFormName(a.name);
    setFormMaxMarks(String(Number(a.maxMarks)));
    setFormDate(
      a.assessmentDate
        ? new Date(a.assessmentDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setFormError("");
  }

  async function submitAssessment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;

    const chosenClass = classes.find((c) => c.id === formClassId);
    if (!chosenClass) {
      setFormError("Please select a class / subject");
      return;
    }
    const max = Number(formMaxMarks);
    if (!Number.isFinite(max) || max <= 0) {
      setFormError("Full marks must be a positive number");
      return;
    }

    setFormError("");
    setIsSavingAssessment(true);
    const payload = {
      subjectId: chosenClass.subjectId,
      name: formName.trim(),
      maxMarks: max,
      assessmentDate: formDate ? new Date(formDate).toISOString() : undefined,
    };

    try {
      const res = await fetch("/api/assessments", {
        method: modal.kind === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          modal.kind === "create" ? payload : { ...payload, id: modal.assessment.id },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to save assessment");
        return;
      }

      setBanner({
        kind: "success",
        text:
          modal.kind === "create"
            ? `Assessment “${payload.name}” created.`
            : `Assessment “${payload.name}” updated.`,
      });
      setModal(null);
      await refreshAssessments().catch(() => {});
      if (modal.kind === "create" && data.assessment?.id) {
        setOpenMarksId(data.assessment.id);
        setMarksState({});
      }
      if (modal.kind === "edit" && openMarksId === modal.assessment.id) {
        setOpenMarksId(null);
        setMarksState({});
      }
    } catch {
      setFormError("Failed to reach the server");
    } finally {
      setIsSavingAssessment(false);
    }
  }

  function askDelete(a: AssessmentItem) {
    setDeleteTarget(a);
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/assessments?id=${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: data.error ?? "Unable to delete assessment" });
        return;
      }
      const n = data.deletedResults ?? 0;
      setBanner({
        kind: "success",
        text:
          n > 0
            ? `Deleted “${deleteTarget.name}” along with ${n} recorded result(s).`
            : `Deleted “${deleteTarget.name}”.`,
      });
      if (openMarksId === deleteTarget.id) {
        setOpenMarksId(null);
        setMarksState({});
      }
      setDeleteTarget(null);
      await refreshAssessments().catch(() => {});
    } catch {
      setBanner({ kind: "error", text: "Unable to reach the server" });
    } finally {
      setIsDeleting(false);
    }
  }

  async function openMarks(a: AssessmentItem) {
    if (openMarksId === a.id) {
      setOpenMarksId(null);
      setMarksState({});
      return;
    }
    setOpenMarksId(a.id);
    setMarksState({});
    setMarksLoading(true);
    try {
      const res = await fetch(`/api/results?assessmentId=${a.id}`);
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: data.error ?? "Unable to load recorded marks" });
        return;
      }
      const state: Record<string, string> = {};
      for (const r of (data.results ?? []) as { studentId: string; marks: number | string }[]) {
        state[r.studentId] = String(Number(r.marks));
      }
      setMarksState(state);
    } catch {
      setBanner({ kind: "error", text: "Unable to load recorded marks" });
    } finally {
      setMarksLoading(false);
    }
  }

  async function saveMarks(a: AssessmentItem) {
    const max = Number(a.maxMarks);
    const rows = Object.entries(marksState).filter(([, v]) => v.trim() !== "");
    if (rows.length === 0) {
      setBanner({ kind: "error", text: "Enter marks for at least one student before saving." });
      return;
    }
    if (rows.some(([, v]) => !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > max)) {
      setBanner({ kind: "error", text: `Marks must be between 0 and ${max}.` });
      return;
    }

    setIsSubmittingMarks(true);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: a.id,
          results: rows.map(([studentId, v]) => ({ studentId, marks: Number(v) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: data.error ?? "Unable to save marks" });
        return;
      }
      setBanner({
        kind: "success",
        text: `Saved marks for ${rows.length} student(s) — grades calculated automatically.`,
      });
      await refreshAssessments().catch(() => {});
    } catch {
      setBanner({ kind: "error", text: "Unable to reach the server" });
    } finally {
      setIsSubmittingMarks(false);
    }
  }

  const bannerStyle: CSSProperties =
    banner?.kind === "error"
      ? { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }
      : { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };

  return (
    <TeacherShell
      active="/teacher/assessments"
      title="Assessments & Student Grading"
      subtitle="Evaluation & Marks Management"
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Faculty Member"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      {banner && (
        <div
          role={banner.kind === "error" ? "alert" : "status"}
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.88rem",
            ...bannerStyle,
          }}
        >
          {banner.text}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>My Assessments</h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            {assessments.length} total · newest first
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={classes.length === 0}
          title={classes.length === 0 ? "Assigned classes will appear here" : "Create a new assessment"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "8px",
            background: "#0ea5e9",
            color: "#fff",
            fontWeight: "700",
            fontSize: "0.85rem",
            border: 0,
            cursor: classes.length === 0 ? "not-allowed" : "pointer",
            opacity: classes.length === 0 ? 0.5 : 1,
          }}
        >
          <IconPlus size={16} aria-hidden="true" />
          New Assessment
        </button>
      </div>

      {isLoading ? (
        <div className="profile-loading">Loading assessments…</div>
      ) : classes.length === 0 ? (
        <div
          className="profile-info-card"
          style={{ padding: "28px", textAlign: "center", color: "var(--ink-soft)" }}
        >
          No classes are assigned to you yet — assessments appear here once the timetable
          assigns you a subject.
        </div>
      ) : assessments.length === 0 ? (
        <div className="profile-info-card" style={{ padding: "28px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            No assessments yet. Click <strong>New Assessment</strong> to create the first one.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {assessments.map((a) => {
            const max = Number(a.maxMarks);
            const isOpen = openMarksId === a.id;
            const recorded = a._count?.results ?? 0;
            const roster = rosterFor(a);

            return (
              <div key={a.id} className="profile-info-card" style={{ padding: "16px 20px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "6px 10px",
                      borderRadius: "8px",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                    }}
                  >
                    {a.subject.code}
                  </span>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{a.name}</div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--ink-soft)",
                        marginTop: "3px",
                      }}
                    >
                      {a.subject.name} · {a.program.code} · Sem {a.semester} · Max {max} ·{" "}
                      {fmtDate(a.assessmentDate)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: recorded > 0 ? "#dcfce7" : "var(--table-row-hover)",
                      color: recorded > 0 ? "#15803d" : "var(--ink-soft)",
                    }}
                  >
                    {recorded > 0 ? `${recorded} recorded` : "No marks yet"}
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={() => openMarks(a)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: `1px solid ${isOpen ? "transparent" : "var(--line-strong)"}`,
                        background: isOpen ? "#0ea5e9" : "transparent",
                        color: isOpen ? "#fff" : "var(--ink)",
                      }}
                    >
                      {isOpen ? "Hide Marks" : "Enter Marks"}
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      title="Edit assessment"
                      aria-label={`Edit ${a.name}`}
                      style={iconBtnStyle}
                    >
                      <IconPencil size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => askDelete(a)}
                      title="Delete assessment"
                      aria-label={`Delete ${a.name}`}
                      style={{ ...iconBtnStyle, color: "#dc2626" }}
                    >
                      <IconTrash size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div
                    style={{
                      marginTop: "14px",
                      borderTop: "1px solid var(--line)",
                      paddingTop: "14px",
                    }}
                  >
                    {marksLoading ? (
                      <div style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
                        Loading recorded marks…
                      </div>
                    ) : roster.length === 0 ? (
                      <div style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
                        No active students found for this class.
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "10px",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                            Grades calculate automatically from marks ÷ {max}. Pass mark 40%.
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "var(--ink-soft)",
                            }}
                          >
                            {filledCount} of {roster.length} filled
                          </span>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "0.85rem",
                              textAlign: "left",
                            }}
                          >
                            <thead>
                              <tr
                                style={{
                                  borderBottom: "1px solid var(--line)",
                                  background: "var(--table-header-bg)",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                <th style={thStyle}>Roll</th>
                                <th style={thStyle}>Student</th>
                                <th style={thStyle}>Marks (0–{max})</th>
                                <th style={thStyle}>Grade (auto)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roster.map((s) => {
                                const raw = marksState[s.id] ?? "";
                                const n = Number(raw);
                                const invalid =
                                  raw.trim() !== "" &&
                                  (!Number.isFinite(n) || n < 0 || n > max);
                                const grade = gradeForMarks(n, max);
                                return (
                                  <tr
                                    key={s.id}
                                    style={{ borderBottom: "1px solid var(--line-faint)" }}
                                  >
                                    <td style={tdStyle}>
                                      {s.rollNumber || s.enrollmentNumber}
                                    </td>
                                    <td style={tdStyle}>
                                      {s.user.firstName} {s.user.lastName}
                                      <div
                                        style={{
                                          fontSize: "0.72rem",
                                          color: "var(--ink-soft)",
                                        }}
                                      >
                                        {s.enrollmentNumber}
                                      </div>
                                    </td>
                                    <td style={tdStyle}>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        max={String(max)}
                                        step="0.5"
                                        placeholder="—"
                                        value={raw}
                                        onChange={(e) =>
                                          setMarksState((prev) => ({
                                            ...prev,
                                            [s.id]: e.target.value,
                                          }))
                                        }
                                        style={{
                                          width: "90px",
                                          padding: "7px 10px",
                                          borderRadius: "8px",
                                          border: `1px solid ${
                                            invalid ? "#ef4444" : "var(--line)"
                                          }`,
                                          background: "var(--panel)",
                                          color: "inherit",
                                        }}
                                      />
                                    </td>
                                    <td style={tdStyle}>
                                      {raw.trim() === "" || invalid || grade === null ? (
                                        <span
                                          style={{
                                            color: invalid ? "#ef4444" : "var(--ink-soft)",
                                            fontSize: "0.8rem",
                                          }}
                                        >
                                          {invalid ? "out of range" : "—"}
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            display: "inline-block",
                                            padding: "3px 10px",
                                            borderRadius: "6px",
                                            fontSize: "0.75rem",
                                            fontWeight: 800,
                                            background:
                                              grade === "F" ? "#fee2e2" : "#dcfce7",
                                            color: grade === "F" ? "#b91c1c" : "#15803d",
                                          }}
                                        >
                                          {grade}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div
                          style={{
                            marginTop: "14px",
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "12px",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                            Leave a field empty to skip that student.
                          </span>
                          <button
                            onClick={() => saveMarks(a)}
                            disabled={isSubmittingMarks}
                            style={{
                              padding: "10px 22px",
                              borderRadius: "8px",
                              background: "#0ea5e9",
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: "0.85rem",
                              border: 0,
                              cursor: isSubmittingMarks ? "wait" : "pointer",
                            }}
                          >
                            {isSubmittingMarks
                              ? "Saving…"
                              : `Save Marks (${filledCount})`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
