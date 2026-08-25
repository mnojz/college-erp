"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";

type Program = {
  id: string;
  name: string;
  code: string;
  departmentName: string;
  durationYears: number;
};

const empty = { name: "", code: "", departmentName: "", durationYears: "4" };

export default function AdminSetupPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok || (await me.json()).user.role !== "ADMIN") {
        router.replace("/");
        return;
      }
      const res = await fetch("/api/programs");
      const data = await res.json();
      setPrograms(data.programs ?? []);
      setLoading(false);
    }
    load().catch(() => { setError("Unable to load programs"); setLoading(false); });
  }, [router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, durationYears: Number(form.durationYears) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Unable to create program"); return; }
    setPrograms((p) => [...p, data.program]);
    setForm(empty);
    setShowModal(false);
    setMessage("Program created successfully.");
  }

  function field(label: string, key: keyof typeof form, type = "text") {
    return (
      <label>
        {label}
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          required
        />
      </label>
    );
  }

  return (
    <AdminShell title="Programs" subtitle="Academic Program Structure" active="/admin/setup">
      {/* Top bar */}
      <div className="admin-topbar">
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
          {loading ? "Loading…" : `${programs.length} program${programs.length !== 1 ? "s" : ""} registered`}
        </p>
        <div className="admin-topbar-actions">
          <button className="btn-add" type="button" onClick={() => { setShowModal(true); setError(""); }}>
            + Add Program
          </button>
        </div>
      </div>

      {/* Data table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Program Name</th>
              <th>Department</th>
              <th>Duration</th>
              <th>Semesters</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  No programs yet. Click <strong>+ Add Program</strong> to create one.
                </td>
              </tr>
            ) : (
              programs.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="badge badge-blue">{p.code}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: "#64748b" }}>{p.departmentName}</td>
                  <td>{p.durationYears} years</td>
                  <td>
                    <span className="badge badge-slate">{p.durationYears * 2} semesters</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}

      {/* Add Program Modal */}
      {showModal && (
        <AdminModal title="Add New Program" onClose={() => setShowModal(false)}>
          <form className="modal-form" onSubmit={submit}>
            {field("Program Name", "name")}
            {field("Program Code (e.g. BCT)", "code")}
            {field("Department Name", "departmentName")}
            {field("Duration (Years)", "durationYears", "number")}
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", fontFamily: "Arial, sans-serif" }}>
              Semesters = duration × 2 (auto-calculated, no manual creation needed)
            </p>
            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Program"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </AdminShell>
  );
}
