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

  // Modals
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [classForm, setClassForm] = useState(emptyClassForm);
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

  // Compute available semesters for Subject form
  const subjectProgram = useMemo(
    () => programs.find((p) => p.id === subjectForm.programId),
    [programs, subjectForm.programId],
  );
  const subjectSemestersCount = subjectProgram ? subjectProgram.durationYears * 2 : 0;

  // Compute available semesters for Class form
  const classProgram = useMemo(
    () => programs.find((p) => p.id === classForm.programId),
    [programs, classForm.programId],
  );
  const classSemestersCount = classProgram ? classProgram.durationYears * 2 : 0;

  // Compute subjects available for chosen program & semester in Class form
  const availableClassSubjects = useMemo(() => {
    if (!classForm.programId || !classForm.semester) return [];
    return subjects.filter(
      (s) => s.programId === classForm.programId && s.semester === Number(classForm.semester),
    );
  }, [subjects, classForm.programId, classForm.semester]);

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
      // Re-fetch subjects to ensure full program relation is populated
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
      // Re-fetch classes
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
              border: "1px solid #e2e8f0",
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
              border: "1px solid #e2e8f0",
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
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
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
                      <span style={{ color: "#64748b" }}>{s.program.code} · </span>
                      {s.program.name}
                    </td>
                    <td>
                      <span className="badge badge-slate">Semester {s.semester}</span>
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
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
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
                      <small style={{ color: "#64748b" }}>{c.teacher.employeeNo}</small>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: "#f0fdf4",
                          color: "#166534",
                          fontWeight: 700,
                        }}
                      >
                        {c.dayOfWeek}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {formatTime(c.startTime)} – {formatTime(c.endTime)}
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

      {/* Modal 2: Add Class Slot */}
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
    </AdminShell>
  );
}
