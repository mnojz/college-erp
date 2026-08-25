"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { ImageUploadCrop } from "@/app/components/common/ImageUploadCrop";

type TeacherItem = {
  id: string;
  employeeNo: string;
  profileImageUrl: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
};

type StudentItem = {
  id: string;
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  admissionDate: string;
  programId: string | null;
  currentSemester: number | null;
  program: { id: string; name: string; code: string } | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
};

type ProgramOption = { id: string; name: string; code: string; durationYears: number };

type DeleteTarget = {
  type: "teacher" | "student";
  id: string;
  name: string;
  identifier: string;
};

const teacherEmpty = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  employeeNo: "",
  profileImageUrl: "",
};

const studentEmpty = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  enrollmentNumber: "",
  registrationId: "",
  rollNumber: "",
  admissionDate: new Date().toISOString().slice(0, 10),
  programId: "",
  currentSemester: "1",
  profileImageUrl: "",
};

export default function AdminPeoplePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"teachers" | "students">("teachers");
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProgramFilter, setSelectedProgramFilter] = useState("ALL");

  // Create Modals
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [teacherForm, setTeacherForm] = useState(teacherEmpty);
  const [studentForm, setStudentForm] = useState(studentEmpty);

  // Edit Modals
  const [editingTeacher, setEditingTeacher] = useState<{ id: string } & typeof teacherEmpty | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: string } & typeof studentEmpty | null>(null);

  // Delete Confirmation Modal
  const [deletingTarget, setDeletingTarget] = useState<DeleteTarget | null>(null);

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
        const [tRes, sRes, pRes] = await Promise.all([
          fetch("/api/teachers"),
          fetch("/api/students"),
          fetch("/api/programs"),
        ]);
        const [td, sd, pd] = await Promise.all([tRes.json(), sRes.json(), pRes.json()]);
        setTeachers(td.teachers ?? []);
        setStudents(sd.students ?? []);
        setPrograms(pd.programs ?? []);
      } catch {
        setError("Unable to load directories");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // Derived semester count for student creation form
  const createStudentProgram = useMemo(
    () => programs.find((p) => p.id === studentForm.programId),
    [programs, studentForm.programId],
  );
  const createStudentSemestersCount = createStudentProgram ? createStudentProgram.durationYears * 2 : 0;

  // Derived semester count for student edit form
  const editStudentProgram = useMemo(
    () => programs.find((p) => p.id === editingStudent?.programId),
    [programs, editingStudent?.programId],
  );
  const editStudentSemestersCount = editStudentProgram ? editStudentProgram.durationYears * 2 : 0;

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.user.firstName.toLowerCase().includes(q) ||
        t.user.lastName.toLowerCase().includes(q) ||
        t.user.email.toLowerCase().includes(q) ||
        t.employeeNo.toLowerCase().includes(q)
      );
    });
  }, [teachers, searchQuery]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchProgram = selectedProgramFilter === "ALL" || s.programId === selectedProgramFilter;
      if (!matchProgram) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.user.firstName.toLowerCase().includes(q) ||
        s.user.lastName.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q) ||
        s.enrollmentNumber.toLowerCase().includes(q) ||
        s.registrationId.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q))
      );
    });
  }, [students, searchQuery, selectedProgramFilter]);

  // Open Edit Teacher modal
  function openEditTeacher(teacher: TeacherItem) {
    setError("");
    setMessage("");
    setEditingTeacher({
      id: teacher.id,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      email: teacher.user.email,
      password: "",
      employeeNo: teacher.employeeNo,
      profileImageUrl: teacher.profileImageUrl || "",
    });
  }

  // Open Edit Student modal
  function openEditStudent(student: StudentItem) {
    setError("");
    setMessage("");
    setEditingStudent({
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      password: "",
      enrollmentNumber: student.enrollmentNumber,
      registrationId: student.registrationId,
      rollNumber: student.rollNumber || "",
      admissionDate: student.admissionDate ? new Date(student.admissionDate).toISOString().slice(0, 10) : "",
      programId: student.programId || "",
      currentSemester: student.currentSemester ? String(student.currentSemester) : "1",
      profileImageUrl: student.profileImageUrl || "",
    });
  }

  // Handle Create Teacher
  async function handleCreateTeacher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teacherForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create teacher account");
        return;
      }
      const refresh = await fetch("/api/teachers");
      const refreshData = await refresh.json();
      setTeachers(refreshData.teachers ?? []);
      setTeacherForm(teacherEmpty);
      setShowTeacherModal(false);
      setMessage(`Faculty account created for ${data.teacher.user.firstName} ${data.teacher.user.lastName}.`);
    } catch {
      setError("Failed to create faculty account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Update Teacher
  async function handleUpdateTeacher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTeacher) return;
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | undefined> = {
        id: editingTeacher.id,
        firstName: editingTeacher.firstName,
        lastName: editingTeacher.lastName,
        email: editingTeacher.email,
        employeeNo: editingTeacher.employeeNo,
        profileImageUrl: editingTeacher.profileImageUrl || undefined,
      };
      if (editingTeacher.password) {
        payload.password = editingTeacher.password;
      }

      const res = await fetch("/api/teachers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update faculty account");
        return;
      }
      const refresh = await fetch("/api/teachers");
      const refreshData = await refresh.json();
      setTeachers(refreshData.teachers ?? []);
      setEditingTeacher(null);
      setMessage(`Profile updated for ${data.teacher.user.firstName} ${data.teacher.user.lastName}.`);
    } catch {
      setError("Failed to update faculty account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Create Student
  async function handleCreateStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | number | undefined> = { ...studentForm };
      if (payload.currentSemester) payload.currentSemester = Number(payload.currentSemester);
      if (!payload.rollNumber) delete payload.rollNumber;
      if (!payload.programId) delete payload.programId;

      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create student account");
        return;
      }
      const refresh = await fetch("/api/students");
      const refreshData = await refresh.json();
      setStudents(refreshData.students ?? []);
      setStudentForm(studentEmpty);
      setShowStudentModal(false);
      setMessage(`Student account created for ${data.student.user.firstName} ${data.student.user.lastName}.`);
    } catch {
      setError("Failed to create student account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Update Student
  async function handleUpdateStudent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingStudent) return;
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string | number | undefined> = {
        id: editingStudent.id,
        firstName: editingStudent.firstName,
        lastName: editingStudent.lastName,
        email: editingStudent.email,
        enrollmentNumber: editingStudent.enrollmentNumber,
        registrationId: editingStudent.registrationId,
        rollNumber: editingStudent.rollNumber || undefined,
        admissionDate: editingStudent.admissionDate,
        programId: editingStudent.programId || undefined,
        currentSemester: editingStudent.currentSemester ? Number(editingStudent.currentSemester) : undefined,
        profileImageUrl: editingStudent.profileImageUrl || undefined,
      };
      if (editingStudent.password) {
        payload.password = editingStudent.password;
      }

      const res = await fetch("/api/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update student account");
        return;
      }
      const refresh = await fetch("/api/students");
      const refreshData = await refresh.json();
      setStudents(refreshData.students ?? []);
      setEditingStudent(null);
      setMessage(`Student profile updated for ${data.student.user.firstName} ${data.student.user.lastName}.`);
    } catch {
      setError("Failed to update student account");
    } finally {
      setSaving(false);
    }
  }

  // Handle Delete Confirmation
  async function handleConfirmDelete() {
    if (!deletingTarget) return;
    setError("");
    setSaving(true);
    const endpoint = deletingTarget.type === "teacher" ? `/api/teachers?id=${deletingTarget.id}` : `/api/students?id=${deletingTarget.id}`;
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete account");
        return;
      }
      if (deletingTarget.type === "teacher") {
        setTeachers((prev) => prev.filter((t) => t.id !== deletingTarget.id));
      } else {
        setStudents((prev) => prev.filter((s) => s.id !== deletingTarget.id));
      }
      setMessage(`${deletingTarget.name} has been removed successfully.`);
      setDeletingTarget(null);
    } catch {
      setError("Unable to process deletion");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="People & Accounts" subtitle="Faculty & Student Directory" active="/admin/people">
      {/* Top action bar */}
      <div className="admin-topbar">
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Program filter for Students tab */}
          {activeTab === "students" && (
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
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Search input */}
          <input
            type="text"
            placeholder={activeTab === "teachers" ? "Search faculty name, emp #, email..." : "Search student, roll, reg #..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
              background: "var(--panel, #fff)",
              color: "inherit",
              width: "260px",
            }}
          />
        </div>

        <div className="admin-topbar-actions">
          <button
            className="btn-add"
            type="button"
            onClick={() => {
              setShowTeacherModal(true);
              setError("");
            }}
          >
            + Add Faculty
          </button>
          <button
            className="btn-add"
            type="button"
            style={{ background: "#2563eb" }}
            onClick={() => {
              setShowStudentModal(true);
              setError("");
            }}
          >
            + Add Student
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === "teachers" ? "active" : ""}`}
          onClick={() => setActiveTab("teachers")}
        >
          Faculty / Teachers ({teachers.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          Enrolled Students ({students.length})
        </button>
      </div>

      {/* Tab 1: Faculty Table */}
      {activeTab === "teachers" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Faculty Member</th>
                <th>Employee Number</th>
                <th>Email Address</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    No faculty records found. Click <strong>+ Add Faculty</strong> to create an account.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {t.profileImageUrl ? (
                          <img
                            src={t.profileImageUrl}
                            alt=""
                            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "#e0f2fe",
                              color: "#0284c7",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 700,
                              fontSize: "13px",
                            }}
                          >
                            {t.user.firstName[0]}
                            {t.user.lastName[0]}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {t.user.firstName} {t.user.lastName}
                          </div>
                          <small style={{ color: "#64748b" }}>Instructor / Faculty</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-blue">{t.employeeNo}</span>
                    </td>
                    <td style={{ color: "#64748b" }}>{t.user.email}</td>
                    <td>
                      <span className={`badge ${t.user.status === "ACTIVE" ? "badge-green" : "badge-slate"}`}>
                        {t.user.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-action-edit"
                          onClick={() => openEditTeacher(t)}
                          title="Edit Faculty Profile"
                          aria-label="Edit Faculty Profile"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() =>
                            setDeletingTarget({
                              type: "teacher",
                              id: t.id,
                              name: `${t.user.firstName} ${t.user.lastName}`,
                              identifier: t.employeeNo,
                            })
                          }
                          title="Delete Faculty Account"
                          aria-label="Delete Faculty Account"
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

      {/* Tab 2: Students Table */}
      {activeTab === "students" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Enrollment & Reg ID</th>
                <th>Program & Semester</th>
                <th>Admission Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    No student records found. Click <strong>+ Add Student</strong> to enroll students.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {s.profileImageUrl ? (
                          <img
                            src={s.profileImageUrl}
                            alt=""
                            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "#dcfce7",
                              color: "#16a34a",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 700,
                              fontSize: "13px",
                            }}
                          >
                            {s.user.firstName[0]}
                            {s.user.lastName[0]}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {s.user.firstName} {s.user.lastName}
                          </div>
                          <small style={{ color: "#64748b" }}>{s.user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.rollNumber ? (
                        <span className="badge badge-amber">#{s.rollNumber}</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.enrollmentNumber}</div>
                      <small style={{ color: "#64748b" }}>{s.registrationId}</small>
                    </td>
                    <td>
                      {s.program ? (
                        <div>
                          <strong style={{ fontSize: "13px" }}>{s.program.code}</strong>
                          {s.currentSemester && (
                            <span style={{ marginLeft: "6px" }} className="badge badge-slate">
                              Sem {s.currentSemester}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ color: "#64748b" }}>
                      {new Date(s.admissionDate).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`badge ${s.user.status === "ACTIVE" ? "badge-green" : "badge-slate"}`}>
                        {s.user.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-action-edit"
                          onClick={() => openEditStudent(s)}
                          title="Edit Student Profile"
                          aria-label="Edit Student Profile"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-action-delete"
                          onClick={() =>
                            setDeletingTarget({
                              type: "student",
                              id: s.id,
                              name: `${s.user.firstName} ${s.user.lastName}`,
                              identifier: s.enrollmentNumber,
                            })
                          }
                          title="Delete Student Account"
                          aria-label="Delete Student Account"
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

      {/* Modal 1: Create Faculty */}
      {showTeacherModal && (
        <AdminModal
          title="Create Faculty / Teacher Account"
          onClose={() => {
            setShowTeacherModal(false);
            setTeacherForm(teacherEmpty);
          }}
        >
          <form className="modal-form" onSubmit={handleCreateTeacher}>
            <div className="inline-pair">
              <label>
                First Name
                <input
                  type="text"
                  placeholder="e.g. Ramesh"
                  value={teacherForm.firstName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
                  required
                />
              </label>
              <label>
                Last Name
                <input
                  type="text"
                  placeholder="e.g. Sharma"
                  value={teacherForm.lastName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Employee ID Number
                <input
                  type="text"
                  placeholder="e.g. FWU-EMP-101"
                  value={teacherForm.employeeNo}
                  onChange={(e) => setTeacherForm({ ...teacherForm, employeeNo: e.target.value })}
                  required
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  placeholder="faculty@fwu.edu.np"
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                  required
                />
              </label>
            </div>

            <label>
              Account Password
              <input
                type="password"
                placeholder="At least 8 characters"
                value={teacherForm.password}
                onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                required
              />
            </label>

            <ImageUploadCrop
              label="Profile Photo (Crop to Square)"
              value={teacherForm.profileImageUrl || ""}
              onChange={(val) => setTeacherForm({ ...teacherForm, profileImageUrl: val })}
            />

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "+ Create Faculty Account"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setShowTeacherModal(false);
                  setTeacherForm(teacherEmpty);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Edit Faculty */}
      {editingTeacher && (
        <AdminModal
          title={`Edit Faculty: ${editingTeacher.firstName} ${editingTeacher.lastName}`}
          onClose={() => setEditingTeacher(null)}
        >
          <form className="modal-form" onSubmit={handleUpdateTeacher}>
            <div className="inline-pair">
              <label>
                First Name
                <input
                  type="text"
                  value={editingTeacher.firstName}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, firstName: e.target.value })}
                  required
                />
              </label>
              <label>
                Last Name
                <input
                  type="text"
                  value={editingTeacher.lastName}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, lastName: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Employee ID Number
                <input
                  type="text"
                  value={editingTeacher.employeeNo}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, employeeNo: e.target.value })}
                  required
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  value={editingTeacher.email}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, email: e.target.value })}
                  required
                />
              </label>
            </div>

            <label>
              Change Password (Optional)
              <input
                type="password"
                placeholder="Leave blank to keep existing password"
                value={editingTeacher.password}
                onChange={(e) => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
              />
            </label>

            <ImageUploadCrop
              label="Profile Photo (Crop to Square)"
              value={editingTeacher.profileImageUrl || ""}
              onChange={(val) => setEditingTeacher({ ...editingTeacher, profileImageUrl: val })}
            />

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setEditingTeacher(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Create Student */}
      {showStudentModal && (
        <AdminModal
          title="Create Student Account"
          onClose={() => {
            setShowStudentModal(false);
            setStudentForm(studentEmpty);
          }}
        >
          <form className="modal-form" onSubmit={handleCreateStudent}>
            <div className="inline-pair">
              <label>
                First Name
                <input
                  type="text"
                  placeholder="e.g. Aayush"
                  value={studentForm.firstName}
                  onChange={(e) => setStudentForm({ ...studentForm, firstName: e.target.value })}
                  required
                />
              </label>
              <label>
                Last Name
                <input
                  type="text"
                  placeholder="e.g. Adhikari"
                  value={studentForm.lastName}
                  onChange={(e) => setStudentForm({ ...studentForm, lastName: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Email Address
                <input
                  type="email"
                  placeholder="student@fwu.edu.np"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  required
                />
              </label>
              <label>
                Account Password
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={studentForm.password}
                  onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Enrollment Number
                <input
                  type="text"
                  placeholder="e.g. 2024-BCT-01"
                  value={studentForm.enrollmentNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, enrollmentNumber: e.target.value })}
                  required
                />
              </label>
              <label>
                Registration ID
                <input
                  type="text"
                  placeholder="e.g. REG-2024-001"
                  value={studentForm.registrationId}
                  onChange={(e) => setStudentForm({ ...studentForm, registrationId: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Roll Number (Optional)
                <input
                  type="text"
                  placeholder="e.g. 01"
                  value={studentForm.rollNumber}
                  onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                />
              </label>
              <label>
                Admission Date
                <input
                  type="date"
                  value={studentForm.admissionDate}
                  onChange={(e) => setStudentForm({ ...studentForm, admissionDate: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Academic Program
                <select
                  value={studentForm.programId}
                  onChange={(e) =>
                    setStudentForm({ ...studentForm, programId: e.target.value, currentSemester: "1" })
                  }
                >
                  <option value="">No program assigned yet</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Current Semester
                <select
                  value={studentForm.currentSemester}
                  onChange={(e) => setStudentForm({ ...studentForm, currentSemester: e.target.value })}
                  disabled={!studentForm.programId}
                >
                  <option value="">
                    {studentForm.programId ? "Select Semester" : "← Pick Program first"}
                  </option>
                  {Array.from({ length: createStudentSemestersCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ImageUploadCrop
              label="Profile Photo (Crop to Square)"
              value={studentForm.profileImageUrl || ""}
              onChange={(val) => setStudentForm({ ...studentForm, profileImageUrl: val })}
            />

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "+ Create Student Account"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setShowStudentModal(false);
                  setStudentForm(studentEmpty);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 4: Edit Student */}
      {editingStudent && (
        <AdminModal
          title={`Edit Student: ${editingStudent.firstName} ${editingStudent.lastName}`}
          onClose={() => setEditingStudent(null)}
        >
          <form className="modal-form" onSubmit={handleUpdateStudent}>
            <div className="inline-pair">
              <label>
                First Name
                <input
                  type="text"
                  value={editingStudent.firstName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, firstName: e.target.value })}
                  required
                />
              </label>
              <label>
                Last Name
                <input
                  type="text"
                  value={editingStudent.lastName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, lastName: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Email Address
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  required
                />
              </label>
              <label>
                Change Password (Optional)
                <input
                  type="password"
                  placeholder="Leave blank to keep existing"
                  value={editingStudent.password}
                  onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Enrollment Number
                <input
                  type="text"
                  value={editingStudent.enrollmentNumber}
                  onChange={(e) => setEditingStudent({ ...editingStudent, enrollmentNumber: e.target.value })}
                  required
                />
              </label>
              <label>
                Registration ID
                <input
                  type="text"
                  value={editingStudent.registrationId}
                  onChange={(e) => setEditingStudent({ ...editingStudent, registrationId: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Roll Number (Optional)
                <input
                  type="text"
                  value={editingStudent.rollNumber}
                  onChange={(e) => setEditingStudent({ ...editingStudent, rollNumber: e.target.value })}
                />
              </label>
              <label>
                Admission Date
                <input
                  type="date"
                  value={editingStudent.admissionDate}
                  onChange={(e) => setEditingStudent({ ...editingStudent, admissionDate: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Academic Program
                <select
                  value={editingStudent.programId}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, programId: e.target.value, currentSemester: "1" })
                  }
                >
                  <option value="">No program assigned yet</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Current Semester
                <select
                  value={editingStudent.currentSemester}
                  onChange={(e) => setEditingStudent({ ...editingStudent, currentSemester: e.target.value })}
                  disabled={!editingStudent.programId}
                >
                  <option value="">
                    {editingStudent.programId ? "Select Semester" : "← Pick Program first"}
                  </option>
                  {Array.from({ length: editStudentSemestersCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ImageUploadCrop
              label="Profile Photo (Crop to Square)"
              value={editingStudent.profileImageUrl || ""}
              onChange={(val) => setEditingStudent({ ...editingStudent, profileImageUrl: val })}
            />

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setEditingStudent(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 5: Delete Confirmation Modal */}
      {deletingTarget && (
        <AdminModal
          title={`Delete ${deletingTarget.type === "teacher" ? "Faculty" : "Student"} Account`}
          onClose={() => setDeletingTarget(null)}
        >
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to permanently delete the account for{" "}
              <strong style={{ color: "var(--foreground, #1e293b)" }}>{deletingTarget.name}</strong>{" "}
              ({deletingTarget.identifier})?
            </p>
            <p style={{ fontSize: "13px", color: "#dc2626", background: "rgba(220, 38, 38, 0.08)", padding: "10px 14px", borderRadius: "8px" }}>
              ⚠️ This action cannot be undone. All associated records, enrollments, attendance, and credentials will be removed.
            </p>

            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button
                className="btn-danger"
                type="button"
                onClick={handleConfirmDelete}
                disabled={saving}
              >
                {saving ? "Deleting…" : "Yes, Delete Account"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setDeletingTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </AdminShell>
  );
}
