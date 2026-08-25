"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { ImageUploadCrop } from "@/app/components/common/ImageUploadCrop";

type Form = Record<string, string>;
type Program = { id: string; name: string; code: string; durationYears: number };

const teacherEmpty: Form = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  employeeNo: "",
  profileImageUrl: "",
};

const studentEmpty: Form = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  enrollmentNumber: "",
  registrationId: "",
  rollNumber: "",
  admissionDate: "",
  programId: "",
  currentSemester: "",
  profileImageUrl: "",
};

export default function AdminPeoplePage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Form>(teacherEmpty);
  const [student, setStudent] = useState<Form>(studentEmpty);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok || (await me.json()).user.role !== "ADMIN") {
        router.replace("/");
        return;
      }
      const progRes = await fetch("/api/programs");
      const progData = await progRes.json();
      setPrograms(progData.programs ?? []);
    }
    load().catch(() => setError("Unable to load academic programs"));
  }, [router]);

  async function submit(
    e: FormEvent<HTMLFormElement>,
    endpoint: string,
    data: Form,
    reset: () => void,
  ) {
    e.preventDefault();
    setError("");
    setMessage("");
    const payload = Object.fromEntries(Object.entries(data).filter(([, value]) => value));
    // Convert currentSemester to number if present
    if (payload.currentSemester) payload.currentSemester = Number(payload.currentSemester) as unknown as string;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await r.json();
    if (!r.ok) {
      setError(result.error ?? "Unable to create account");
      return;
    }
    reset();
    setMessage("Account created successfully!");
  }

  const field = (
    label: string,
    key: string,
    state: Form,
    set: (next: Form) => void,
    type = "text",
    optional = false,
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={state[key] || ""}
        onChange={(e) => set({ ...state, [key]: e.target.value })}
        required={!optional}
      />
    </label>
  );

  const selectedProgram = programs.find((p) => p.id === student.programId);
  const semesterCount = selectedProgram ? selectedProgram.durationYears * 2 : 0;

  return (
    <AdminShell title="People & Accounts" subtitle="Faculty & Student Directory" active="/admin/people">
      <section className="admin-form-layout">
        {/* Create Teacher Form */}
        <article className="profile-info-card admin-form-card">
          <h2>Create Faculty / Teacher</h2>
          <form onSubmit={(e) => submit(e, "/api/teachers", teacher, () => setTeacher(teacherEmpty))}>
            {field("Email", "email", teacher, setTeacher, "email")}
            {field("Password", "password", teacher, setTeacher, "password")}
            <div className="admin-inline-fields">
              {field("First name", "firstName", teacher, setTeacher)}
              {field("Last name", "lastName", teacher, setTeacher)}
            </div>
            {field("Employee number", "employeeNo", teacher, setTeacher)}

            <ImageUploadCrop
              label="Profile Photo (Crop to Square)"
              value={teacher.profileImageUrl || ""}
              onChange={(val) => setTeacher({ ...teacher, profileImageUrl: val })}
            />

            <button className="admin-primary" type="submit">
              + Create Faculty Account
            </button>
          </form>
        </article>

        {/* Create Student Form */}
        <article className="profile-info-card admin-form-card">
          <h2>Create Student</h2>
          <form onSubmit={(e) => submit(e, "/api/students", student, () => setStudent(studentEmpty))}>
            {field("Email", "email", student, setStudent, "email")}
            {field("Password", "password", student, setStudent, "password")}
            <div className="admin-inline-fields">
              {field("First name", "firstName", student, setStudent)}
              {field("Last name", "lastName", student, setStudent)}
            </div>
            <div className="admin-inline-fields">
              {field("Enrollment number", "enrollmentNumber", student, setStudent)}
              {field("Registration ID", "registrationId", student, setStudent)}
            </div>
            <div className="admin-inline-fields">
              {field("Roll number", "rollNumber", student, setStudent, "text", true)}
              {field("Admission date", "admissionDate", student, setStudent, "date")}
            </div>

            <div className="admin-inline-fields">
              <label>
                Program
                <select
                  value={student.programId || ""}
                  onChange={(e) =>
                    setStudent({ ...student, programId: e.target.value, currentSemester: "" })
                  }
                >
                  <option value="">No program assigned yet</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Current Semester
                <select
                  value={student.currentSemester || ""}
                  onChange={(e) => setStudent({ ...student, currentSemester: e.target.value })}
                  disabled={!student.programId}
                >
                  <option value="">Select Semester</option>
                  {Array.from({ length: semesterCount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ImageUploadCrop
              label="Profile Photo (Crop to Square)"
              value={student.profileImageUrl || ""}
              onChange={(val) => setStudent({ ...student, profileImageUrl: val })}
            />

            <button className="admin-primary" type="submit">
              + Create Student Account
            </button>
          </form>
        </article>
      </section>

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}
    </AdminShell>
  );
}
