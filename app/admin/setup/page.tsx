"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string; code: string };
type FormValues = Record<string, string>;

const emptyDepartment = { name: "", code: "" };
const emptyYear = { name: "", startsOn: "", endsOn: "" };
const emptyProgram = { name: "", code: "", durationYears: "4", departmentId: "" };
const emptyCourse = { code: "", name: "", credits: "3", departmentId: "" };

export default function AdminSetupPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [department, setDepartment] = useState<FormValues>(emptyDepartment);
  const [year, setYear] = useState<FormValues>(emptyYear);
  const [program, setProgram] = useState<FormValues>(emptyProgram);
  const [course, setCourse] = useState<FormValues>(emptyCourse);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        router.replace("/login");
        return;
      }
      const meResult = await me.json();
      if (meResult.user.role !== "ADMIN") {
        router.replace("/");
        return;
      }
      const response = await fetch("/api/departments");
      const result = await response.json();
      setDepartments(result.departments ?? []);
    }
    load().catch(() => setError("Unable to load setup data"));
  }, [router]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    values: FormValues,
    reset: () => void,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = { ...values };
    if ("durationYears" in payload) payload.durationYears = Number(payload.durationYears) as unknown as string;
    if ("credits" in payload) payload.credits = Number(payload.credits) as unknown as string;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to save record");
        return;
      }
      reset();
      setMessage("Record created successfully");
      if (endpoint === "/api/departments") {
        setDepartments((current) => [...current, result.department].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch {
      setError("Unable to reach the server");
    }
  }

  function update(setter: (value: FormValues) => void, current: FormValues, key: string, value: string) {
    setter({ ...current, [key]: value });
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div><p className="eyebrow">Administration</p><h1>Set up college records</h1></div>
        <button className="quiet-button" type="button" onClick={() => router.push("/admin")}>Back to overview</button>
      </header>
      {error && <p className="banner error-banner" role="alert">{error}</p>}
      {message && <p className="banner success-banner" role="status">{message}</p>}

      <section className="setup-grid">
        <SetupCard title="Department">
          <form onSubmit={(event) => submit(event, "/api/departments", department, () => setDepartment(emptyDepartment))}>
            <Field label="Name" value={department.name} onChange={(value) => update(setDepartment, department, "name", value)} />
            <Field label="Code" value={department.code} onChange={(value) => update(setDepartment, department, "code", value)} />
            <button className="primary-button" type="submit">Create department</button>
          </form>
        </SetupCard>

        <SetupCard title="Academic year">
          <form onSubmit={(event) => submit(event, "/api/academic-years", year, () => setYear(emptyYear))}>
            <Field label="Name" placeholder="2026 / 27" value={year.name} onChange={(value) => update(setYear, year, "name", value)} />
            <Field label="Starts" type="date" value={year.startsOn} onChange={(value) => update(setYear, year, "startsOn", value)} />
            <Field label="Ends" type="date" value={year.endsOn} onChange={(value) => update(setYear, year, "endsOn", value)} />
            <button className="primary-button" type="submit">Create academic year</button>
          </form>
        </SetupCard>

        <SetupCard title="Program">
          <form onSubmit={(event) => submit(event, "/api/programs", program, () => setProgram(emptyProgram))}>
            <Field label="Name" value={program.name} onChange={(value) => update(setProgram, program, "name", value)} />
            <Field label="Code" value={program.code} onChange={(value) => update(setProgram, program, "code", value)} />
            <Field label="Duration in years" type="number" value={program.durationYears} onChange={(value) => update(setProgram, program, "durationYears", value)} />
            <DepartmentSelect value={program.departmentId} departments={departments} onChange={(value) => update(setProgram, program, "departmentId", value)} />
            <button className="primary-button" type="submit">Create program</button>
          </form>
        </SetupCard>

        <SetupCard title="Course">
          <form onSubmit={(event) => submit(event, "/api/courses", course, () => setCourse(emptyCourse))}>
            <Field label="Code" value={course.code} onChange={(value) => update(setCourse, course, "code", value)} />
            <Field label="Name" value={course.name} onChange={(value) => update(setCourse, course, "name", value)} />
            <Field label="Credits" type="number" value={course.credits} onChange={(value) => update(setCourse, course, "credits", value)} />
            <DepartmentSelect value={course.departmentId} departments={departments} onChange={(value) => update(setCourse, course, "departmentId", value)} />
            <button className="primary-button" type="submit">Create course</button>
          </form>
        </SetupCard>
      </section>
    </main>
  );
}

function SetupCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="setup-card"><p className="eyebrow">New record</p><h2>{title}</h2>{children}</article>;
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label>{label}<input type={type} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} required /></label>;
}

function DepartmentSelect({ value, departments, onChange }: { value: string; departments: Department[]; onChange: (value: string) => void }) {
  return <label>Department<select value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Select department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>;
}
