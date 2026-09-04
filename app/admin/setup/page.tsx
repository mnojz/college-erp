"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { IconAlertTriangle, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";

type Department = {
  id: string;
  name: string;
  code: string;
  programCount: number;
};

type Program = {
  id: string;
  name: string;
  code: string;
  departmentName: string;
  durationYears: number;
};

const programEmpty = { name: "", code: "", durationYears: "4" };

/** Derive a short department code from its name, e.g. "Engineering" → "ENG". */
function suggestDeptCode(name: string) {
  return name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

export default function AdminSetupPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);

  // Program modals
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [editingProgram, setEditingProgram] = useState<(Program & { durationYearsStr: string }) | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<Program | null>(null);
  const [programForm, setProgramForm] = useState(programEmpty);

  // One-time department setup
  const [deptForm, setDeptForm] = useState({ name: "", code: "" });
  const [showSetDept, setShowSetDept] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [pRes, dRes] = await Promise.all([fetch("/api/programs"), fetch("/api/departments")]);
    const [pData, dData] = await Promise.all([pRes.json(), dRes.json()]);
    setPrograms(pData.programs ?? []);
    setDepartment(dData.department ?? null);
  }

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok || (await me.json()).user.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }
      await refresh();
      setLoading(false);
    }
    load().catch(() => { setError("Unable to load academic structure"); setLoading(false); });
  }, [router]);

  /* ── Department setup (single, one-time) ─────────────────────── */

  async function handleSetDept(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const updating = Boolean(department);
    try {
      const res = await fetch("/api/departments", {
        method: updating ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deptForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to save department"); return; }
      await refresh();
      setShowSetDept(false);
      setMessage(
        updating
          ? "Department updated successfully. Its new name/code is used everywhere across the system."
          : `Department ${data.department.code} set successfully. It is used everywhere across the system.`,
      );
    } catch {
      setError("Unable to submit department");
    } finally {
      setSaving(false);
    }
  }

  /* ── Program handlers ────────────────────────────────────── */

  async function handleCreateProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...programForm, durationYears: Number(programForm.durationYears) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to create program"); return; }
      await refresh();
      setProgramForm(programEmpty);
      setShowCreateProgram(false);
      setMessage(`Program ${data.program.code} created successfully.`);
    } catch {
      setError("Unable to submit program");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProgram(e: FormEvent<HTMLFormElement>) {
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
          durationYears: Number(editingProgram.durationYearsStr),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to update program"); return; }
      await refresh();
      setEditingProgram(null);
      setMessage(`Program ${data.program.code} updated successfully.`);
    } catch {
      setError("Unable to update program");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProgram() {
    if (!deletingProgram) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/programs?id=${deletingProgram.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to delete program"); return; }
      await refresh();
      setMessage(`Program ${deletingProgram.code} has been deleted.`);
      setDeletingProgram(null);
    } catch {
      setError("Unable to delete program");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Department & Programs" subtitle="Academic Structure" active="/admin/setup">
      {/* Top bar */}
      <div className="admin-topbar">
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
          {loading
            ? "Loading…"
            : `${department ? department.code : "Department not set yet"} · ${programs.length} program${programs.length !== 1 ? "s" : ""} registered`}
        </p>
        <div className="admin-topbar-actions">
          {!department && (
            <button
              className="btn-add"
              type="button"
              onClick={() => { setDeptForm({ name: "", code: "" }); setShowSetDept(true); setError(""); }}
            >
              <IconPlus size={15} aria-hidden="true" />
              Set Department
            </button>
          )}
          <button
            className="btn-add"
            type="button"
            style={{ background: "#2563eb" }}
            onClick={() => { setShowCreateProgram(true); setError(""); }}
          >
            <IconPlus size={15} aria-hidden="true" />
            Add Program
          </button>
        </div>
      </div>

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}

      {/* Department card (single, one-time setup) */}
      {department ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "var(--panel, #fff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 28,
          }}
        >
          <span className="badge badge-violet" style={{ fontSize: 13, padding: "5px 10px" }}>
            {department.code}
          </span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
              {department.name} Department
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
              Your department. All programs, subjects, classes and users are assigned to it automatically.
            </p>
          </div>
          <button
            type="button"
            className="btn-action-edit"
            title="Edit Department"
            aria-label="Edit Department"
            style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 8, flexShrink: 0 }}
            onClick={() => {
              setDeptForm({ name: department.name, code: department.code });
              setError("");
              setShowSetDept(true);
            }}
          >
            <IconPencil size={15} />
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "var(--panel, #fff)",
            border: "1px dashed var(--line, #e2e8f0)",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
              Set up your department once
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
              Enter your department name and code — this is used across the entire system.
            </p>
          </div>
          <button className="btn-add" type="button" onClick={() => { setDeptForm({ name: "", code: "" }); setShowSetDept(true); setError(""); }}>
            <IconPlus size={15} aria-hidden="true" />
            Set Department
          </button>
        </div>
      )}

      {/* Programs table */}
      <div className="admin-table-wrap" style={{ marginTop: "28px" }}>
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
                  No programs yet. Click <strong>Add Program</strong> to create one.
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
                    <div className="table-actions" style={{ justifyContent: "flex-end" }}>
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
                        <IconPencil size={15} />
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

      {/* Modal 1: Set Department (one-time) */}
      {showSetDept && (
        <AdminModal title={department ? "Edit Department" : "Set Your Department"} onClose={() => setShowSetDept(false)}>
          <form className="modal-form" onSubmit={handleSetDept}>
            <label>
              Department Name
              <input
                type="text"
                placeholder="e.g. Engineering"
                value={deptForm.name}
                onChange={(e) =>
                  setDeptForm((f) => ({
                    ...f,
                    name: e.target.value,
                    code: f.code || suggestDeptCode(e.target.value),
                  }))
                }
                required
              />
            </label>
            <label>
              Department Code
              <input
                type="text"
                placeholder="e.g. ENG"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", fontFamily: "Arial, sans-serif" }}>
              This is your institution&apos;s single department. It is assigned to every program, subject,
              class and user automatically. You can update the name or code later from the department card.
            </p>
            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? (department ? "Saving…" : "Setting…") : department ? "Save Changes" : "Set Department"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setShowSetDept(false)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Add Program */}
      {showCreateProgram && (
        <AdminModal title="Add New Program" onClose={() => setShowCreateProgram(false)}>
          <form className="modal-form" onSubmit={handleCreateProgram}>
            <label>
              Program Name
              <input
                type="text"
                placeholder="e.g. B.E. Degree in Computer Engineering"
                value={programForm.name}
                onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                required
              />
            </label>
            <label>
              Program Code (e.g. BCT)
              <input
                type="text"
                placeholder="BCT"
                value={programForm.code}
                onChange={(e) => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <label>
              Duration (Years)
              <input
                type="number"
                min={1}
                max={6}
                value={programForm.durationYears}
                onChange={(e) => setProgramForm({ ...programForm, durationYears: e.target.value })}
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
              <button className="btn-ghost" type="button" onClick={() => setShowCreateProgram(false)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 5: Edit Program */}
      {editingProgram && (
        <AdminModal title={`Edit Program: ${editingProgram.code}`} onClose={() => setEditingProgram(null)}>
          <form className="modal-form" onSubmit={handleUpdateProgram}>
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

      {/* Modal 6: Delete Program Confirmation */}
      {deletingProgram && (
        <AdminModal title={`Delete Program: ${deletingProgram.code}`} onClose={() => setDeletingProgram(null)}>
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete the program <strong>{deletingProgram.name} ({deletingProgram.code})</strong>?
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "#dc2626",
                background: "rgba(220, 38, 38, 0.08)",
                padding: "10px 14px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                margin: 0,
              }}
            >
              <IconAlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>Deleting this program will remove all affiliated subjects, scheduled classes, assessments, and unassign enrolled students.</span>
            </p>
            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-danger" type="button" onClick={handleDeleteProgram} disabled={saving}>
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
