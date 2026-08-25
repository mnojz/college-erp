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

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<(Program & { durationYearsStr: string }) | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<Program | null>(null);

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

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, durationYears: Number(form.durationYears) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to create program"); return; }
      setPrograms((p) => [...p, data.program]);
      setForm(empty);
      setShowCreateModal(false);
      setMessage(`Program ${data.program.code} created successfully.`);
    } catch {
      setError("Unable to submit program");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingProgram) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProgram.id,
          name: editingProgram.name,
          code: editingProgram.code,
          departmentName: editingProgram.departmentName,
          durationYears: Number(editingProgram.durationYearsStr),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to update program"); return; }
      setPrograms((prev) => prev.map((p) => (p.id === data.program.id ? data.program : p)));
      setEditingProgram(null);
      setMessage(`Program ${data.program.code} updated successfully.`);
    } catch {
      setError("Unable to update program");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingProgram) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/programs?id=${deletingProgram.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to delete program"); return; }
      setPrograms((prev) => prev.filter((p) => p.id !== deletingProgram.id));
      setMessage(`Program ${deletingProgram.code} has been deleted.`);
      setDeletingProgram(null);
    } catch {
      setError("Unable to delete program");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Programs" subtitle="Academic Program Structure" active="/admin/setup">
      {/* Top bar */}
      <div className="admin-topbar">
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
          {loading ? "Loading…" : `${programs.length} program${programs.length !== 1 ? "s" : ""} registered`}
        </p>
        <div className="admin-topbar-actions">
          <button className="btn-add" type="button" onClick={() => { setShowCreateModal(true); setError(""); }}>
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
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="admin-table-empty">
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
                  <td style={{ color: "var(--ink-soft)" }}>{p.departmentName}</td>
                  <td>{p.durationYears} years</td>
                  <td>
                    <span className="badge badge-slate">{p.durationYears * 2} semesters</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn-action-edit"
                        title="Edit Program"
                        aria-label="Edit Program"
                        onClick={() => {
                          setError("");
                          setEditingProgram({ ...p, durationYearsStr: String(p.durationYears) });
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
                        title="Delete Program"
                        aria-label="Delete Program"
                        onClick={() => {
                          setError("");
                          setDeletingProgram(p);
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

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}

      {/* Modal 1: Add Program Modal */}
      {showCreateModal && (
        <AdminModal title="Add New Program" onClose={() => setShowCreateModal(false)}>
          <form className="modal-form" onSubmit={handleCreate}>
            <label>
              Program Name
              <input
                type="text"
                placeholder="e.g. Bachelor in Computer Engineering"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Program Code (e.g. BCT)
              <input
                type="text"
                placeholder="BCT"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <label>
              Department Name
              <input
                type="text"
                placeholder="Department of Computer & Electronics Engineering"
                value={form.departmentName}
                onChange={(e) => setForm({ ...form, departmentName: e.target.value })}
                required
              />
            </label>
            <label>
              Duration (Years)
              <input
                type="number"
                min={1}
                max={6}
                value={form.durationYears}
                onChange={(e) => setForm({ ...form, durationYears: e.target.value })}
                required
              />
            </label>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", fontFamily: "Arial, sans-serif" }}>
              Total Semesters = duration × 2 (auto-calculated)
            </p>
            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Program"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Edit Program Modal */}
      {editingProgram && (
        <AdminModal title={`Edit Program: ${editingProgram.code}`} onClose={() => setEditingProgram(null)}>
          <form className="modal-form" onSubmit={handleUpdate}>
            <label>
              Program Name
              <input
                type="text"
                value={editingProgram.name}
                onChange={(e) => setEditingProgram({ ...editingProgram, name: e.target.value })}
                required
              />
            </label>
            <label>
              Program Code
              <input
                type="text"
                value={editingProgram.code}
                onChange={(e) => setEditingProgram({ ...editingProgram, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <label>
              Department Name
              <input
                type="text"
                value={editingProgram.departmentName}
                onChange={(e) => setEditingProgram({ ...editingProgram, departmentName: e.target.value })}
                required
              />
            </label>
            <label>
              Duration (Years)
              <input
                type="number"
                min={1}
                max={6}
                value={editingProgram.durationYearsStr}
                onChange={(e) => setEditingProgram({ ...editingProgram, durationYearsStr: e.target.value })}
                required
              />
            </label>
            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setEditingProgram(null)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Delete Program Confirmation */}
      {deletingProgram && (
        <AdminModal title={`Delete Program: ${deletingProgram.code}`} onClose={() => setDeletingProgram(null)}>
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete the program <strong>{deletingProgram.name} ({deletingProgram.code})</strong>?
            </p>
            <p style={{ fontSize: "13px", color: "#dc2626", background: "rgba(220, 38, 38, 0.08)", padding: "10px 14px", borderRadius: "8px" }}>
              ⚠️ Deleting this program will remove all affiliated subjects, scheduled classes, assessments, and unassign enrolled students.
            </p>
            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-danger" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Program"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setDeletingProgram(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </AdminShell>
  );
}
