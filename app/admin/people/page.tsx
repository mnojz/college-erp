"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string; code: string };
type Program = { id: string; name: string; code: string };

type PersonForm = Record<string, string>;

const initialTeacher: PersonForm = { email: "", password: "", firstName: "", lastName: "", employeeNo: "", departmentId: "" };
const initialStudent: PersonForm = { email: "", password: "", firstName: "", lastName: "", admissionNo: "", rollNumber: "", admissionDate: "", programId: "", profileImageUrl: "" };

export default function AdminPeoplePage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<PersonForm>(initialTeacher);
  const [student, setStudent] = useState<PersonForm>(initialStudent);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const meResponse = await fetch("/api/auth/me");
      if (!meResponse.ok) return router.replace("/");
      const me = await meResponse.json();
      if (me.user.role !== "ADMIN") return router.replace("/");
      const [departmentsResponse, programsResponse] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/programs"),
      ]);
      const departmentsResult = await departmentsResponse.json();
      const programsResult = await programsResponse.json();
      setDepartments(departmentsResult.departments ?? []);
      setPrograms(programsResult.programs ?? []);
    }
    load().catch(() => setError("Unable to load departments and programs"));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>, endpoint: string, values: PersonForm, reset: () => void) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload: Record<string, string> = { ...values };
    for (const key of Object.keys(payload)) {
      if (!payload[key]) delete payload[key];
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to create account");
        return;
      }
      reset();
      setMessage("Account created successfully");
    } catch {
      setError("Unable to reach the server");
    }
  }

  const update = (setter: (value: PersonForm) => void, current: PersonForm, key: string, value: string) => setter({ ...current, [key]: value });

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div><p className="eyebrow">Administration</p><h1>Create people</h1></div>
        <button className="quiet-button" type="button" onClick={() => router.push("/admin")}>Back to overview</button>
      </header>
      {error && <p className="banner error-banner" role="alert">{error}</p>}
      {message && <p className="banner success-banner" role="status">{message}</p>}
      <section className="setup-grid">
        <PersonCard title="Teacher account">
          <form onSubmit={(event) => submit(event, "/api/teachers", teacher, () => setTeacher(initialTeacher))}>
            <Field label="Email" type="email" value={teacher.email} onChange={(value) => update(setTeacher, teacher, "email", value)} />
            <Field label="Password" type="password" value={teacher.password} onChange={(value) => update(setTeacher, teacher, "password", value)} />
            <Field label="First name" value={teacher.firstName} onChange={(value) => update(setTeacher, teacher, "firstName", value)} />
            <Field label="Last name" value={teacher.lastName} onChange={(value) => update(setTeacher, teacher, "lastName", value)} />
            <Field label="Employee number" value={teacher.employeeNo} onChange={(value) => update(setTeacher, teacher, "employeeNo", value)} />
            <Select label="Department" value={teacher.departmentId} options={departments} onChange={(value) => update(setTeacher, teacher, "departmentId", value)} optional />
            <button className="primary-button" type="submit">Create teacher</button>
          </form>
        </PersonCard>
        <PersonCard title="Student account">
          <form onSubmit={(event) => submit(event, "/api/students", student, () => setStudent(initialStudent))}>
            <Field label="Email" type="email" value={student.email} onChange={(value) => update(setStudent, student, "email", value)} />
            <Field label="Password" type="password" value={student.password} onChange={(value) => update(setStudent, student, "password", value)} />
            <Field label="First name" value={student.firstName} onChange={(value) => update(setStudent, student, "firstName", value)} />
            <Field label="Last name" value={student.lastName} onChange={(value) => update(setStudent, student, "lastName", value)} />
            <Field label="Admission number" value={student.admissionNo} onChange={(value) => update(setStudent, student, "admissionNo", value)} />
            <Field label="Roll number" value={student.rollNumber} onChange={(value) => update(setStudent, student, "rollNumber", value)} />
            <Field label="Admission date" type="date" value={student.admissionDate} onChange={(value) => update(setStudent, student, "admissionDate", value)} />
            {programs.length > 0 ? (
              <Select label="Program" value={student.programId} options={programs} onChange={(value) => update(setStudent, student, "programId", value)} />
            ) : (
              <p className="inline-help">No programs found. <a href="/admin/setup">Create a program first</a>.</p>
            )}
            <Field label="Profile image URL (optional)" type="url" value={student.profileImageUrl} onChange={(value) => update(setStudent, student, "profileImageUrl", value)} />
            <button className="primary-button" type="submit" disabled={!programs.length}>Create student</button>
          </form>
        </PersonCard>
      </section>
    </main>
  );
}

function PersonCard({ title, children }: { title: string; children: React.ReactNode }) { return <article className="setup-card"><p className="eyebrow">New account</p><h2>{title}</h2>{children}</article>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={label !== "Profile image URL (optional)"} /></label>; }
function Select({ label, value, options, onChange, optional = false }: { label: string; value: string; options: { id: string; name: string; code: string }[]; onChange: (value: string) => void; optional?: boolean }) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)} required={!optional}><option value="">{optional ? "None" : `Select ${label.toLowerCase()}`}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.code} · {option.name}</option>)}</select></label>; }
