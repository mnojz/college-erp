"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
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
  subjectTeachers: Array<{
    id: string;
    subject: { id: string; code: string; name: string; semester: number };
  }>;
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
  gender: string | null;
  nationality: string | null;
  religion: string | null;
  category: string | null;
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
type SubjectOption = {
  id: string;
  code: string;
  name: string;
  semester: number;
  program: { name: string; code: string } | null;
};

type DeleteTarget = {
  type: "teacher" | "student";
  id: string;
  name: string;
  identifier: string;
};

const teacherEmpty: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string;
  subjectIds: string[];
} = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  employeeNo: "",
  profileImageUrl: "",
  subjectIds: [],
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
  // Critical personal information — admin-entered only.
  gender: "",
  nationality: "",
  religion: "",
  category: "",
};

/**
 * Subject-assignment picker for the faculty create/edit modals.
 *
 * Shows only the subjects already assigned to the teacher as removable chips,
 * plus a dedicated "Assign Subject" button. Clicking it expands a searchable
 * catalog of ALL subjects — assigned ones appear disabled ("✓ Assigned"),
 * unassigned ones are added on click. The parent's assignedIds drives both
 * lists, so assigning/removing instantly updates the chips.
 */
function SubjectAssigner({
  subjects,
  assignedIds,
  onChange,
}: {
  subjects: SubjectOption[];
  assignedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [programFilter, setProgramFilter] = useState("ALL");

  const assigned = subjects.filter((s) => assignedIds.includes(s.id));
  const q = query.trim().toLowerCase();
  const visible = subjects.filter((s) => {
    if (programFilter !== "ALL" && (s.program?.code ?? "") !== programFilter) return false;
    if (semesterFilter !== "ALL" && String(s.semester) !== semesterFilter) return false;
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.program?.code ?? "").toLowerCase().includes(q) ||
      (s.program?.name ?? "").toLowerCase().includes(q)
    );
  });

  // Distinct semesters present across the catalog (for the filter dropdown).
  const semesters = useMemo(
    () => Array.from(new Set(subjects.map((s) => s.semester))).sort((a, b) => a - b),
    [subjects],
  );

  // Distinct programs present across the catalog (for the filter dropdown).
  const programs = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string }>();
    for (const s of subjects) {
      if (s.program && !byCode.has(s.program.code)) {
        byCode.set(s.program.code, s.program);
      }
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [subjects]);

  const filtersActive = programFilter !== "ALL" || semesterFilter !== "ALL";
  const activeFilterLabel = [
    programFilter !== "ALL" ? `program ${programFilter}` : "",
    semesterFilter !== "ALL" ? `semester ${semesterFilter}` : "",
    q ? `“${query.trim()}”` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const chipStyle = {
    padding: "5px 10px",
    fontWeight: 600,
  };

  return (
    <div style={{ display: "grid", gap: "8px", marginTop: "4px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
        Assigned Subjects
        <span style={{ fontWeight: 400 }}> — drives automatic class scheduling</span>
      </span>

      {assigned.length === 0 ? (
        <p className="form-hint" style={{ margin: 0 }}>
          No subjects assigned yet. Click “Assign Subject” below to add one.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {assigned.map((s) => (
            <span key={s.id} className="badge badge-violet" style={chipStyle}>
              <strong style={{ fontWeight: 800 }}>{s.code}</strong>
              <span style={{ fontWeight: 500 }}>{s.name}</span>
              <span style={{ opacity: 0.8, fontWeight: 500 }}>Sem {s.semester}</span>
              {s.program && <span style={{ opacity: 0.8, fontWeight: 500 }}>{s.program.code}</span>}
              <button
                type="button"
                title={`Remove ${s.code} from this teacher`}
                aria-label={`Remove ${s.code}`}
                onClick={() => onChange(assignedIds.filter((id) => id !== s.id))}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  opacity: 0.7,
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  display: "inline-flex",
                }}
              >
                <IconX size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className={pickerOpen ? "btn-ghost" : "btn-add"}
          onClick={() => setPickerOpen((v) => !v)}
        >
          {pickerOpen ? (
            "Done"
          ) : (
            <>
              <IconPlus size={15} aria-hidden="true" />
              Assign Subject
            </>
          )}
        </button>
        {assigned.length > 0 && (
          <span className="form-hint" style={{ margin: 0 }}>
            {assigned.length} of {subjects.length} subjects
          </span>
        )}
      </div>

      {pickerOpen && (
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "10px",
            background: "var(--panel)",
            display: "grid",
            gap: "8px",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            {/* Row 1 — full-width search */}
            <div style={{ position: "relative" }}>
              <IconSearch
                size={15}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ink-soft)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
              <input
                type="search"
                placeholder="Search subjects by code, name, or program…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                style={{ paddingLeft: 36 }}
              />
            </div>

            {/* Row 2 — filters */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto",
                gap: 10,
                alignItems: "end",
              }}
            >
              <label style={{ display: "grid", gap: 5 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Program
                </span>
                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                >
                  <option value="ALL">All programs</option>
                  {programs.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 5 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Semester
                </span>
                <select
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value)}
                >
                  <option value="ALL">All semesters</option>
                  {semesters.map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>

              {filtersActive && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setProgramFilter("ALL");
                    setSemesterFilter("ALL");
                  }}
                  title="Clear filters"
                  style={{
                    whiteSpace: "nowrap",
                    padding: "10px 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    justifyContent: "center",
                  }}
                >
                  <IconX size={13} aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            {/* List header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 2px 4px",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-soft)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Subjects
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                {visible.length} of {subjects.length}
              </span>
            </div>

            <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gap: "2px" }}>
            {visible.length === 0 ? (
              <span style={{ color: "var(--ink-soft)", fontSize: 13, padding: "2px 4px" }}>
                {subjects.length === 0
                  ? "No subjects yet — publish a curriculum first."
                  : `No subjects match: ${activeFilterLabel || "current filters"}.`}
              </span>
            ) : (
              visible.map((s) => {
                const isAssigned = assignedIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isAssigned}
                    onClick={() => onChange([...assignedIds, s.id])}
                    title={isAssigned ? "Already assigned" : `Assign ${s.code} · ${s.name}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      width: "100%",
                      padding: "7px 9px",
                      border: "none",
                      borderRadius: 7,
                      background: "transparent",
                      color: "inherit",
                      cursor: isAssigned ? "default" : "pointer",
                      fontSize: 13,
                      textAlign: "left",
                      opacity: isAssigned ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isAssigned) e.currentTarget.style.background = "var(--line)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span>
                      <strong>{s.code}</strong> · {s.name}
                      <span style={{ color: "var(--ink-soft)" }}>
                        {" "}
                        — {s.program?.code ?? ""} · Sem {s.semester}
                      </span>
                    </span>
                    {isAssigned ? (
                      <span
                        style={{
                          color: "#059669",
                          flexShrink: 0,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <IconCircleCheck size={15} aria-hidden="true" />
                        Assigned
                      </span>
                    ) : (
                      <IconPlus
                        size={15}
                        style={{ color: "#059669", flexShrink: 0 }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })
            )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AdminPeoplePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"teachers" | "students">("teachers");
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
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
          router.replace("/dashboard");
          return;
        }
        const [tRes, sRes, pRes, subRes] = await Promise.all([
          fetch("/api/teachers"),
          fetch("/api/students"),
          fetch("/api/programs"),
          fetch("/api/subjects"),
        ]);
        const [td, sd, pd, subd] = await Promise.all([tRes.json(), sRes.json(), pRes.json(), subRes.json()]);
        setTeachers(td.teachers ?? []);
        setStudents(sd.students ?? []);
        setPrograms(pd.programs ?? []);
        setSubjects(subd.subjects ?? []);
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
      subjectIds: (teacher.subjectTeachers ?? []).map((st) => st.subject.id),
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
      gender: student.gender || "",
      nationality: student.nationality || "",
      religion: student.religion || "",
      category: student.category || "",
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
        body: JSON.stringify({
          ...teacherForm,
          subjectIds: teacherForm.subjectIds,
        }),
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
      const payload: Record<string, string | string[] | undefined> = {
        id: editingTeacher.id,
        firstName: editingTeacher.firstName,
        lastName: editingTeacher.lastName,
        email: editingTeacher.email,
        employeeNo: editingTeacher.employeeNo,
        profileImageUrl: editingTeacher.profileImageUrl || undefined,
        subjectIds: editingTeacher.subjectIds,
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
        gender: editingStudent.gender || undefined,
        nationality: editingStudent.nationality || undefined,
        religion: editingStudent.religion || undefined,
        category: editingStudent.category || undefined,
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
    <AdminShell title="People & Accounts" subtitle="Teachers & Student Directory" active="/admin/people">
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
            placeholder={activeTab === "teachers" ? "Search teacher name, emp #, email..." : "Search student, roll, reg #..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid var(--input-border)",
              fontSize: "13px",
              background: "var(--input-bg)",
              color: "var(--input-color)",
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
            <IconPlus size={15} aria-hidden="true" />
            Add Teacher
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
            <IconPlus size={15} aria-hidden="true" />
            Add Student
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
          Teachers ({teachers.length})
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
                <th>Assigned Subjects</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
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
                      {(t.subjectTeachers ?? []).length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 220 }}>
                          {(t.subjectTeachers ?? []).map((st) => (
                            <span key={st.id} className="badge badge-violet">
                              {st.subject.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>None</span>
                      )}
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
                          <IconPencil size={15} />
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
                          <IconTrash size={15} />
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
                          <IconPencil size={15} />
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
                          <IconTrash size={15} />
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

            <SubjectAssigner
              subjects={subjects}
              assignedIds={teacherForm.subjectIds}
              onChange={(next) => setTeacherForm((f) => ({ ...f, subjectIds: next }))}
            />

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : (
                  <>
                    <IconPlus size={15} aria-hidden="true" />
                    Create Faculty Account
                  </>
                )}
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

            <SubjectAssigner
              subjects={subjects}
              assignedIds={editingTeacher.subjectIds}
              onChange={(next) =>
                setEditingTeacher((t) => (t ? { ...t, subjectIds: next } : t))
              }
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
                    {studentForm.programId ? "Select Semester" : "Pick Program first"}
                  </option>
                  {Array.from({ length: createStudentSemestersCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="form-hint" style={{ marginTop: 2 }}>
              Personal information below is critical — only admins can set it, students cannot
              change it later. Contact &amp; guardian details are filled in by the student from
              their own profile.
            </p>
            <div className="inline-pair">
              <label>
                Gender
                <select
                  value={studentForm.gender}
                  onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                >
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                Category
                <input
                  type="text"
                  placeholder="e.g. Open, Reserved"
                  value={studentForm.category}
                  onChange={(e) => setStudentForm({ ...studentForm, category: e.target.value })}
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Nationality
                <input
                  type="text"
                  placeholder="e.g. Nepali"
                  value={studentForm.nationality}
                  onChange={(e) => setStudentForm({ ...studentForm, nationality: e.target.value })}
                />
              </label>
              <label>
                Religion
                <input
                  type="text"
                  placeholder="e.g. Hindu"
                  value={studentForm.religion}
                  onChange={(e) => setStudentForm({ ...studentForm, religion: e.target.value })}
                />
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
                {saving ? "Creating…" : (
                  <>
                    <IconPlus size={15} aria-hidden="true" />
                    Create Student Account
                  </>
                )}
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
                    {editingStudent.programId ? "Select Semester" : "Pick Program first"}
                  </option>
                  {Array.from({ length: editStudentSemestersCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="form-hint" style={{ marginTop: 2 }}>
              Personal information below is critical — only admins can set it, students cannot
              change it later.
            </p>
            <div className="inline-pair">
              <label>
                Gender
                <select
                  value={editingStudent.gender}
                  onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value })}
                >
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                Category
                <input
                  type="text"
                  placeholder="e.g. Open, Reserved"
                  value={editingStudent.category}
                  onChange={(e) => setEditingStudent({ ...editingStudent, category: e.target.value })}
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Nationality
                <input
                  type="text"
                  placeholder="e.g. Nepali"
                  value={editingStudent.nationality}
                  onChange={(e) => setEditingStudent({ ...editingStudent, nationality: e.target.value })}
                />
              </label>
              <label>
                Religion
                <input
                  type="text"
                  placeholder="e.g. Hindu"
                  value={editingStudent.religion}
                  onChange={(e) => setEditingStudent({ ...editingStudent, religion: e.target.value })}
                />
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
            <p style={{ fontSize: "13px", color: "#dc2626", background: "rgba(220, 38, 38, 0.08)", padding: "10px 14px", borderRadius: "8px", display: "flex", alignItems: "center", gap: 8 }}>
              <IconAlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
              This action cannot be undone. All associated records, enrollments, attendance, and credentials will be removed.
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
