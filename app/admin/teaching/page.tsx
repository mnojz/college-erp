"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";

type ProgramOption = { id: string; name: string; code: string; durationYears: number };
type SubjectItem = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
  program: { name: string; code: string };
};
type TeacherOption = { id: string; name: string; employeeNo: string };
type ClassItem = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId: string;
  programId: string;
  semester: number;
  subject: { name: string; code: string };
  program: { name: string; code: string };
  teacher: {
    employeeNo: string;
    user: { firstName: string; lastName: string };
  };
};

const emptySubjectForm = { name: "", code: "", programId: "", semester: "" };
const emptyClassForm = {
  programId: "",
  semester: "",
  subjectId: "",
  teacherId: "",
  dayOfWeek: "MONDAY",
  startTime: "09:00",
  endTime: "10:30",
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

function formatTime(isoTime: string) {
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return isoTime;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return isoTime;
  }
}

function timeToHHMM(isoTime: string) {
  try {
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return isoTime.slice(11, 16);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  } catch {
    return "09:00";
  }
}

export default function AdminTeachingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"subjects" | "classes">("subjects");
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProgramFilter, setSelectedProgramFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modals
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [classForm, setClassForm] = useState(emptyClassForm);

  // Edit Modals
  const [editingSubject, setEditingSubject] = useState<{ id: string } & typeof emptySubjectForm | null>(null);
  const [editingClass, setEditingClass] = useState<{ id: string } & typeof emptyClassForm | null>(null);

  // Delete Confirmations
  const [deletingSubject, setDeletingSubject] = useState<SubjectItem | null>(null);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/");
          return;
        }
        const [pRes, sRes, cRes, tRes] = await Promise.all([
          fetch("/api/programs"),
          fetch("/api/subjects"),
          fetch("/api/classes"),
          fetch("/api/teachers"),
        ]);
        const [pd, sd, cd, td] = await Promise.all([pRes.json(), sRes.json(), cRes.json(), tRes.json()]);
        setPrograms(pd.programs ?? []);
        setSubjects(sd.subjects ?? []);
        setClasses(cd.classes ?? []);
        setTeachers(
          (td.teachers ?? []).map(
            (x: { id: string; employeeNo: string; user: { firstName: string; lastName: string } }) => ({
              id: x.id,
              employeeNo: x.employeeNo,
              name: `${x.user.firstName} ${x.user.lastName}`,
            }),
          ),
        );
      } catch {
        setError("Unable to load teaching and curriculum records");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Derived Semesters for Create Subject Form
  const subjectProgram = useMemo(
    () => programs.find((p) => p.id === subjectForm.programId),
    [programs, subjectForm.programId],
  );
  const subjectSemestersCount = subjectProgram ? subjectProgram.durationYears * 2 : 0;

  // Derived Semesters for Edit Subject Form
  const editSubjectProgram = useMemo(
    () => programs.find((p) => p.id === editingSubject?.programId),
    [programs, editingSubject],
  );
  const editSubjectSemestersCount = editSubjectProgram ? editSubjectProgram.durationYears * 2 : 0;

  // Derived Semesters for Create Class Form
  const classProgram = useMemo(
    () => programs.find((p) => p.id === classForm.programId),
    [programs, classForm.programId],
  );
  const classSemestersCount = classProgram ? classProgram.durationYears * 2 : 0;

  // Derived Semesters for Edit Class Form
  const editClassProgram = useMemo(
    () => programs.find((p) => p.id === editingClass?.programId),
    [programs, editingClass],
  );
  const editClassSemestersCount = editClassProgram ? editClassProgram.durationYears * 2 : 0;

  // Subjects for Create Class
  const availableClassSubjects = useMemo(() => {
    if (!classForm.programId || !classForm.semester) return [];
    return subjects.filter(
      (s) => s.programId === classForm.programId && s.semester === Number(classForm.semester),
    );
  }, [subjects, classForm.programId, classForm.semester]);

  // Subjects for Edit Class
  const editAvailableClassSubjects = useMemo(() => {
    if (!editingClass?.programId || !editingClass?.semester) return [];
    return subjects.filter(
      (s) => s.programId === editingClass.programId && s.semester === Number(editingClass.semester),
    );
  }, [subjects, editingClass]);

  // Filtered lists
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchProgram = selectedProgramFilter === "ALL" || s.programId === selectedProgramFilter;
      const matchQuery =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.program.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchProgram && matchQuery;
    });
  }, [subjects, selectedProgramFilter, searchQuery]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      const matchProgram = selectedProgramFilter === "ALL" || c.programId === selectedProgramFilter;
      const matchQuery =
        !searchQuery ||
        c.subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subject.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${c.teacher.user.firstName} ${c.teacher.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
      return matchProgram && matchQuery;
    });
  }, [classes, selectedProgramFilter, searchQuery]);

  // Handle Create Subject
  async function handleCreateSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subjectForm.name,
          code: subjectForm.code,
          programId: subjectForm.programId,
          semester: Number(subjectForm.semester),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create subject");
        return;
      }
      const refresh = await fetch("/api/subjects");
      const refreshData = await refresh.json();
      setSubjects(refreshData.subjects ?? []);
      setSubjectForm(emptySubjectForm);
      setShowSubjectModal(false);
      setMessage(`Subject ${data.subject.code} created successfully.`);
    } catch {
      setError("Failed to submit subject");
    } finally {
      setSaving(false);
    }
  }

  // Handle Update Subject
  async function handleUpdateSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSubject) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSubject.id,
          name: editingSubject.name,
          code: editingSubject.code,
          programId: editingSubject.programId,
          semester: Number(editingSubject.semester),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update subject");
        return;
      }
      const refresh = await fetch("/api/subjects");
      const refreshData = await refresh.json();
      setSubjects(refreshData.subjects ?? []);
      setEditingSubject(null);
      setMessage(`Subject ${data.subject.code} updated successfully.`);
    } catch {
      setError("Failed to update subject");
    } finally {
      setSaving(false);
    }
  }

  // Handle Delete Subject
  async function handleDeleteSubject() {
    if (!deletingSubject) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/subjects?id=${deletingSubject.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete subject");
        return;
      }
      setSubjects((prev) => prev.filter((s) => s.id !== deletingSubject.id));
      setMessage(`Subject ${deletingSubject.code} has been deleted.`);
      setDeletingSubject(null);
    } catch {
      setError("Failed to delete subject");
    } finally {
      setSaving(false);
    }
  }

  // Handle Create Class
  async function handleCreateClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: classForm.programId,
          semester: Number(classForm.semester),
          subjectId: classForm.subjectId,
          teacherId: classForm.teacherId,
          dayOfWeek: classForm.dayOfWeek,
          startTime: classForm.startTime,
          endTime: classForm.endTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create class slot");
        return;
      }
      const refresh = await fetch("/api/classes");
      const refreshData = await refresh.json();
      setClasses(refreshData.classes ?? []);
      setClassForm(emptyClassForm);
      setShowClassModal(false);
      setMessage("Class slot scheduled successfully.");
    } catch {
      setError("Failed to schedule class");
    } finally {
      setSaving(false);
    }
  }

  // Handle Update Class
  async function handleUpdateClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClass) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingClass.id,
          programId: editingClass.programId,
          semester: Number(editingClass.semester),
          subjectId: editingClass.subjectId,
          teacherId: editingClass.teacherId,
          dayOfWeek: editingClass.dayOfWeek,
          startTime: editingClass.startTime,
          endTime: editingClass.endTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update class slot");
        return;
      }
      const refresh = await fetch("/api/classes");
      const refreshData = await refresh.json();
      setClasses(refreshData.classes ?? []);
      setEditingClass(null);
      setMessage("Class slot updated successfully.");
    } catch {
      setError("Failed to update class schedule");
    } finally {
      setSaving(false);
    }
  }

  // Handle Delete Class
  async function handleDeleteClass() {
    if (!deletingClass) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/classes?id=${deletingClass.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete class slot");
        return;
      }
      setClasses((prev) => prev.filter((c) => c.id !== deletingClass.id));
      setMessage("Class slot deleted successfully.");
      setDeletingClass(null);
    } catch {
      setError("Failed to delete class slot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Curriculum & Schedules" subtitle="Academic Management" active="/admin/teaching">
      {/* Top action bar */}
      <div className="admin-topbar">
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Program filter */}
          <select
            value={selectedProgramFilter}
            onChange={(e) => setSelectedProgramFilter(e.target.value)}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid var(--line, #e2e8f0)",
              fontSize: "13px",
              background: "var(--panel, #fff)",
              color: "inherit",
              width: "auto",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>

          {/* Search input */}
          <input
            type="text"
            placeholder="Search code, title, teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid var(--line, #e2e8f0)",
              fontSize: "13px",
              background: "var(--panel, #fff)",
              color: "inherit",
              width: "220px",
            }}
          />
        </div>

        <div className="admin-topbar-actions">
          <button
            className="btn-add"
            type="button"
            onClick={() => {
              setShowSubjectModal(true);
              setError("");
            }}
          >
            + Add Subject
          </button>
          <button
            className="btn-add"
            type="button"
            style={{ background: "#2563eb" }}
            onClick={() => {
              setShowClassModal(true);
              setError("");
            }}
          >
            + Add Class Slot
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === "subjects" ? "active" : ""}`}
          onClick={() => setActiveTab("subjects")}
        >
          Subjects ({subjects.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "classes" ? "active" : ""}`}
          onClick={() => setActiveTab("classes")}
        >
          Class Schedules ({classes.length})
        </button>
      </div>

      {/* Tab 1: Subjects Table */}
      {activeTab === "subjects" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject Name</th>
                <th>Program</th>
                <th>Semester</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    No subjects found. Click <strong>+ Add Subject</strong> to add curriculum courses.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="badge badge-blue">{s.code}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <span style={{ color: "var(--ink-soft)" }}>{s.program.code} · </span>
                      {s.program.name}
                    </td>
                    <td>
                      <span className="badge badge-slate">Semester {s.semester}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-action-edit"
                          title="Edit Subject"
                          aria-label="Edit Subject"
                          onClick={() => {
                            setError("");
                            setEditingSubject({
                              id: s.id,
                              name: s.name,
                              code: s.code,
                              programId: s.programId,
                              semester: String(s.semester),
                            });
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          title="Delete Subject"
                          aria-label="Delete Subject"
                          onClick={() => {
                            setError("");
                            setDeletingSubject(s);
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Classes Table */}
      {activeTab === "classes" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Program & Semester</th>
                <th>Faculty / Teacher</th>
                <th>Day of Week</th>
                <th>Time Slot</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    No scheduled classes found. Click <strong>+ Add Class Slot</strong> to assign lecture times.
                  </td>
                </tr>
              ) : (
                filteredClasses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="badge badge-blue">{c.subject.code}</span>
                        <span style={{ fontWeight: 600 }}>{c.subject.name}</span>
                      </div>
                    </td>
                    <td>
                      <span>{c.program.code}</span> ·{" "}
                      <span className="badge badge-slate">Semester {c.semester}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {c.teacher.user.firstName} {c.teacher.user.lastName}
                      </div>
                      <small style={{ color: "var(--ink-soft)" }}>{c.teacher.employeeNo}</small>
                    </td>
                    <td>
                      <span className="badge badge-green">
                        {c.dayOfWeek}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {formatTime(c.startTime)} – {formatTime(c.endTime)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-action-edit"
                          title="Edit Class Schedule"
                          aria-label="Edit Class Schedule"
                          onClick={() => {
                            setError("");
                            setEditingClass({
                              id: c.id,
                              programId: c.programId,
                              semester: String(c.semester),
                              subjectId: c.subjectId,
                              teacherId: c.teacherId,
                              dayOfWeek: c.dayOfWeek,
                              startTime: timeToHHMM(c.startTime),
                              endTime: timeToHHMM(c.endTime),
                            });
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          title="Delete Class Schedule"
                          aria-label="Delete Class Schedule"
                          onClick={() => {
                            setError("");
                            setDeletingClass(c);
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}

      {/* Modal 1: Add Subject */}
      {showSubjectModal && (
        <AdminModal
          title="Add New Subject"
          onClose={() => {
            setShowSubjectModal(false);
            setSubjectForm(emptySubjectForm);
          }}
        >
          <form className="modal-form" onSubmit={handleCreateSubject}>
            <label>
              Program
              <select
                value={subjectForm.programId}
                onChange={(e) => setSubjectForm({ ...subjectForm, programId: e.target.value, semester: "" })}
                required
              >
                <option value="">Select Academic Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({p.durationYears * 2} Semesters)
                  </option>
                ))}
              </select>
            </label>

            <label>
              Semester
              <select
                value={subjectForm.semester}
                onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                disabled={!subjectForm.programId}
                required
              >
                <option value="">
                  {subjectForm.programId ? "Select Semester Number" : "← Please choose a program first"}
                </option>
                {Array.from({ length: subjectSemestersCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    Semester {n}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Subject Name
              <input
                type="text"
                placeholder="e.g. Database Management Systems"
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                required
              />
            </label>

            <label>
              Subject Code
              <input
                type="text"
                placeholder="e.g. BCT601"
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                required
              />
            </label>

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "+ Create Subject"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setShowSubjectModal(false);
                  setSubjectForm(emptySubjectForm);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Edit Subject */}
      {editingSubject && (
        <AdminModal
          title={`Edit Subject: ${editingSubject.code}`}
          onClose={() => setEditingSubject(null)}
        >
          <form className="modal-form" onSubmit={handleUpdateSubject}>
            <label>
              Program
              <select
                value={editingSubject.programId}
                onChange={(e) => setEditingSubject({ ...editingSubject, programId: e.target.value, semester: "1" })}
                required
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Semester
              <select
                value={editingSubject.semester}
                onChange={(e) => setEditingSubject({ ...editingSubject, semester: e.target.value })}
                required
              >
                {Array.from({ length: editSubjectSemestersCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    Semester {n}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Subject Name
              <input
                type="text"
                value={editingSubject.name}
                onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                required
              />
            </label>

            <label>
              Subject Code
              <input
                type="text"
                value={editingSubject.code}
                onChange={(e) => setEditingSubject({ ...editingSubject, code: e.target.value.toUpperCase() })}
                required
              />
            </label>

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setEditingSubject(null)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Delete Subject Confirmation */}
      {deletingSubject && (
        <AdminModal
          title={`Delete Subject: ${deletingSubject.code}`}
          onClose={() => setDeletingSubject(null)}
        >
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete the course <strong>{deletingSubject.name} ({deletingSubject.code})</strong>?
            </p>
            <p style={{ fontSize: "13px", color: "#dc2626", background: "rgba(220, 38, 38, 0.08)", padding: "10px 14px", borderRadius: "8px" }}>
              ⚠️ Deleting this subject will permanently remove all scheduled lecture slots, assessments, and attendance records associated with it.
            </p>
            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-danger" type="button" onClick={handleDeleteSubject} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Subject"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setDeletingSubject(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Modal 4: Add Class Slot */}
      {showClassModal && (
        <AdminModal
          title="Schedule New Class Slot"
          onClose={() => {
            setShowClassModal(false);
            setClassForm(emptyClassForm);
          }}
        >
          <form className="modal-form" onSubmit={handleCreateClass}>
            <div className="inline-pair">
              <label>
                Program
                <select
                  value={classForm.programId}
                  onChange={(e) =>
                    setClassForm({
                      ...classForm,
                      programId: e.target.value,
                      semester: "",
                      subjectId: "",
                    })
                  }
                  required
                >
                  <option value="">Select Program</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Semester
                <select
                  value={classForm.semester}
                  onChange={(e) =>
                    setClassForm({
                      ...classForm,
                      semester: e.target.value,
                      subjectId: "",
                    })
                  }
                  disabled={!classForm.programId}
                  required
                >
                  <option value="">
                    {classForm.programId ? "Select Semester" : "← Pick Program"}
                  </option>
                  {Array.from({ length: classSemestersCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Subject Course
              <select
                value={classForm.subjectId}
                onChange={(e) => setClassForm({ ...classForm, subjectId: e.target.value })}
                disabled={!classForm.programId || !classForm.semester}
                required
              >
                <option value="">
                  {!classForm.programId || !classForm.semester
                    ? "← Choose Program & Semester above first"
                    : availableClassSubjects.length === 0
                    ? "No subjects registered for this semester"
                    : "Select Subject"}
                </option>
                {availableClassSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assigned Faculty / Teacher
              <select
                value={classForm.teacherId}
                onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}
                required
              >
                <option value="">Select Faculty Member</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.employeeNo})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Weekday
              <select
                value={classForm.dayOfWeek}
                onChange={(e) => setClassForm({ ...classForm, dayOfWeek: e.target.value })}
                required
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-pair">
              <label>
                Start Time
                <input
                  type="time"
                  value={classForm.startTime}
                  onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })}
                  required
                />
              </label>
              <label>
                End Time
                <input
                  type="time"
                  value={classForm.endTime}
                  onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
                  required
                />
              </label>
            </div>

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Scheduling…" : "+ Schedule Class"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setShowClassModal(false);
                  setClassForm(emptyClassForm);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 5: Edit Class Slot */}
      {editingClass && (
        <AdminModal
          title="Edit Class Schedule Slot"
          onClose={() => setEditingClass(null)}
        >
          <form className="modal-form" onSubmit={handleUpdateClass}>
            <div className="inline-pair">
              <label>
                Program
                <select
                  value={editingClass.programId}
                  onChange={(e) =>
                    setEditingClass({
                      ...editingClass,
                      programId: e.target.value,
                      semester: "1",
                      subjectId: "",
                    })
                  }
                  required
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Semester
                <select
                  value={editingClass.semester}
                  onChange={(e) =>
                    setEditingClass({
                      ...editingClass,
                      semester: e.target.value,
                      subjectId: "",
                    })
                  }
                  required
                >
                  {Array.from({ length: editClassSemestersCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Subject Course
              <select
                value={editingClass.subjectId}
                onChange={(e) => setEditingClass({ ...editingClass, subjectId: e.target.value })}
                required
              >
                <option value="">
                  {editAvailableClassSubjects.length === 0
                    ? "No subjects registered for this semester"
                    : "Select Subject"}
                </option>
                {editAvailableClassSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Assigned Faculty / Teacher
              <select
                value={editingClass.teacherId}
                onChange={(e) => setEditingClass({ ...editingClass, teacherId: e.target.value })}
                required
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.employeeNo})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Weekday
              <select
                value={editingClass.dayOfWeek}
                onChange={(e) => setEditingClass({ ...editingClass, dayOfWeek: e.target.value })}
                required
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-pair">
              <label>
                Start Time
                <input
                  type="time"
                  value={editingClass.startTime}
                  onChange={(e) => setEditingClass({ ...editingClass, startTime: e.target.value })}
                  required
                />
              </label>
              <label>
                End Time
                <input
                  type="time"
                  value={editingClass.endTime}
                  onChange={(e) => setEditingClass({ ...editingClass, endTime: e.target.value })}
                  required
                />
              </label>
            </div>

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setEditingClass(null)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 6: Delete Class Confirmation */}
      {deletingClass && (
        <AdminModal
          title="Delete Class Schedule Slot"
          onClose={() => setDeletingClass(null)}
        >
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete this lecture slot for{" "}
              <strong>{deletingClass.subject.name} ({deletingClass.subject.code})</strong> on {deletingClass.dayOfWeek} (
              {formatTime(deletingClass.startTime)} - {formatTime(deletingClass.endTime)})?
            </p>
            <p style={{ fontSize: "13px", color: "#dc2626", background: "rgba(220, 38, 38, 0.08)", padding: "10px 14px", borderRadius: "8px" }}>
              ⚠️ Deleting this schedule will remove its associated attendance sessions and student attendance records.
            </p>
            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-danger" type="button" onClick={handleDeleteClass} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Slot"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setDeletingClass(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </AdminShell>
  );
}
