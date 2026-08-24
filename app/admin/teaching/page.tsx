"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name?: string; code?: string };
type FormValues = Record<string, string>;

export default function AdminTeachingPage() {
  const router = useRouter();
  const [years, setYears] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [terms, setTerms] = useState<Option[]>([]);
  const [offerings, setOfferings] = useState<Option[]>([]);
  const [term, setTerm] = useState<FormValues>({ name: "", number: "1", academicYearId: "" });
  const [offering, setOffering] = useState<FormValues>({ courseId: "", termId: "", teacherId: "", programId: "", section: "A" });
  const [enrollment, setEnrollment] = useState<FormValues>({ studentId: "", offeringId: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok) return router.replace("/login");
      const meResult = await me.json();
      if (meResult.user.role !== "ADMIN") return router.replace("/");

      const endpoints = ["academic-years", "courses", "teachers", "programs", "students", "terms", "offerings"];
      const results = await Promise.all(endpoints.map((endpoint) => fetch(`/api/${endpoint}`).then((response) => response.json())));
      setYears(results[0].academicYears ?? []);
      setCourses(results[1].courses ?? []);
      setTeachers(results[2].teachers ?? []);
      setPrograms(results[3].programs ?? []);
      setStudents(results[4].students ?? []);
      setTerms(results[5].terms ?? []);
      setOfferings(results[6].offerings ?? []);
    }
    load().catch(() => setError("Unable to load teaching setup data"));
  }, [router]);

  async function create(event: FormEvent<HTMLFormElement>, endpoint: string, values: FormValues, reset: () => void) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload: Record<string, string | number> = { ...values };
    if ("number" in payload) payload.number = Number(payload.number);

    try {
      const response = await fetch(`/api/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) return setError(result.error ?? "Unable to create record");
      reset();
      setMessage("Record created successfully");
      if (endpoint === "terms") setTerms((current) => [...current, result.term]);
      if (endpoint === "offerings") setOfferings((current) => [...current, result.offering]);
    } catch {
      setError("Unable to reach the server");
    }
  }

  const update = (setter: (value: FormValues) => void, current: FormValues, key: string, value: string) => setter({ ...current, [key]: value });

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><div><p className="eyebrow">Administration</p><h1>Classes and enrollment</h1></div><button className="quiet-button" type="button" onClick={() => router.push("/admin")}>Back to overview</button></header>
      {error && <p className="banner error-banner" role="alert">{error}</p>}
      {message && <p className="banner success-banner" role="status">{message}</p>}
      <section className="setup-grid">
        <SetupCard title="Term">
          <form onSubmit={(event) => create(event, "terms", term, () => setTerm({ name: "", number: "1", academicYearId: "" }))}>
            <Field label="Name" value={term.name} onChange={(value) => update(setTerm, term, "name", value)} />
            <Field label="Term number" type="number" value={term.number} onChange={(value) => update(setTerm, term, "number", value)} />
            <Select label="Academic year" value={term.academicYearId} options={years} onChange={(value) => update(setTerm, term, "academicYearId", value)} />
            <button className="primary-button" type="submit">Create term</button>
          </form>
        </SetupCard>
        <SetupCard title="Course offering">
          <form onSubmit={(event) => create(event, "offerings", offering, () => setOffering({ courseId: "", termId: "", teacherId: "", programId: "", section: "A" }))}>
            <Select label="Course" value={offering.courseId} options={courses} onChange={(value) => update(setOffering, offering, "courseId", value)} useCode />
            <Select label="Term" value={offering.termId} options={terms} onChange={(value) => update(setOffering, offering, "termId", value)} />
            <Select label="Teacher" value={offering.teacherId} options={teachers} onChange={(value) => update(setOffering, offering, "teacherId", value)} useCode />
            <Select label="Program (optional)" value={offering.programId} options={programs} onChange={(value) => update(setOffering, offering, "programId", value)} optional />
            <Field label="Section" value={offering.section} onChange={(value) => update(setOffering, offering, "section", value)} />
            <button className="primary-button" type="submit">Create offering</button>
          </form>
        </SetupCard>
        <SetupCard title="Enroll student">
          <form onSubmit={(event) => create(event, "enrollments", enrollment, () => setEnrollment({ studentId: "", offeringId: "" }))}>
            <Select label="Student" value={enrollment.studentId} options={students} onChange={(value) => update(setEnrollment, enrollment, "studentId", value)} useCode />
            <Select label="Course offering" value={enrollment.offeringId} options={offerings} onChange={(value) => update(setEnrollment, enrollment, "offeringId", value)} useCode />
            <button className="primary-button" type="submit">Enroll student</button>
          </form>
        </SetupCard>
      </section>
    </main>
  );
}

function SetupCard({ title, children }: { title: string; children: React.ReactNode }) { return <article className="setup-card"><p className="eyebrow">New record</p><h2>{title}</h2>{children}</article>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required /></label>; }
function Select({ label, value, options, onChange, useCode = false, optional = false }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; useCode?: boolean; optional?: boolean }) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)} required={!optional}><option value="">{optional ? "None" : `Select ${label.toLowerCase()}`}</option>{options.map((option) => <option key={option.id} value={option.id}>{useCode && option.code ? `${option.code} · ` : ""}{option.name ?? option.id}</option>)}</select></label>; }
