"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";

type Program = { id: string; name: string; code: string; durationYears: number };

const emptyProgram = { name: "", code: "", durationYears: "4", departmentName: "" };

export default function AdminSetupPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [program, setProgram] = useState(emptyProgram);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok || (await me.json()).user.role !== "ADMIN") return router.replace("/");
      const response = await fetch("/api/programs");
      setPrograms((await response.json()).programs ?? []);
    }
    load().catch(() => setError("Unable to load programs"));
  }, [router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...program, durationYears: Number(program.durationYears) }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Unable to save record");
    setPrograms([...programs, data.program]);
    setProgram(emptyProgram);
    setMessage("Program created successfully");
  }

  return (
    <AdminShell title="Programs" subtitle="Academic Program Structure" active="/admin/setup">
      <section className="admin-form-layout">
        {/* Create Program */}
        <article className="profile-info-card admin-form-card">
          <h2>Create a Program</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginBottom: "16px" }}>
            Semesters are automatically calculated from the program duration (e.g. 4 years = 8 semesters). No manual semester creation needed.
          </p>
          <form onSubmit={submit}>
            <Field label="Program Name" value={program.name} update={(v) => setProgram({ ...program, name: v })} />
            <Field label="Program Code" value={program.code} update={(v) => setProgram({ ...program, code: v })} />
            <Field
              label="Department Name"
              value={program.departmentName}
              update={(v) => setProgram({ ...program, departmentName: v })}
            />
            <Field
              label="Duration (Years)"
              type="number"
              value={program.durationYears}
              update={(v) => setProgram({ ...program, durationYears: v })}
            />
            <button className="admin-primary" type="submit">
              + Create Program
            </button>
          </form>
        </article>

        {/* Programs List */}
        {programs.length > 0 && (
          <article className="profile-info-card admin-form-card">
            <h2>Existing Programs</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {programs.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "var(--surface-2, #f8f9fa)",
                    border: "1px solid var(--border, #e5e7eb)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem" }}>{p.code}</strong>
                    <span style={{ marginLeft: "10px", color: "var(--ink-soft)", fontSize: "0.85rem" }}>{p.name}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "3px 10px",
                      borderRadius: "99px",
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      fontWeight: 600,
                    }}
                  >
                    {p.durationYears * 2} Semesters
                  </span>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}
    </AdminShell>
  );
}

function Field({
  label,
  value,
  update,
  type = "text",
}: {
  label: string;
  value: string;
  update: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(e) => update(e.target.value)} required />
    </label>
  );
}
