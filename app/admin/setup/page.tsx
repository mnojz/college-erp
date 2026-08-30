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
  departmentId?: string | null;
  durationYears: number;
};

const deptEmpty = { name: "", code: "" };
const programEmpty = { name: "", code: "", departmentId: "", durationYears: "4" };

/** Derive a short department code from its name, e.g. "Engineering" → "ENG". */
function suggestDeptCode(name: string) {
  return name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

export default function AdminSetupPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Program modals
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [editingProgram, setEditingProgram] = useState<(Program & { durationYearsStr: string }) | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<Program | null>(null);
  const [programForm, setProgramForm] = useState(programEmpty);

  // Department modals
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState(deptEmpty);
  const [deptCodeTouched, setDeptCodeTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [pRes, dRes] = await Promise.all([fetch("/api/programs"), fetch("/api/departments")]);
    const [pData, dData] = await Promise.all([pRes.json(), dRes.json()]);
    setPrograms(pData.programs ?? []);
    setDepartments(dData.departments ?? []);
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

  /* ── Department handlers ─────────────────────────────────── */

  async function handleCreateDept(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deptForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to create department"); return; }
      await refresh();
      setDeptForm(deptEmpty);
      setDeptCodeTouched(false);
      setShowCreateDept(false);
      setMessage(`Department ${data.department.code} created successfully.`);
    } catch {
      setError("Unable to submit department");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDept(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingDept) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/departments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingDept.id, name: editingDept.name, code: editingDept.code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to update department"); return; }
      await refresh();
      setEditingDept(null);
      setMessage(`Department ${data.department.code} updated successfully.`);
    } catch {
      setError("Unable to update department");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDept() {
    if (!deletingDept) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/departments?id=${deletingDept.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Unable to delete department"); return; }
      await refresh();
      setMessage(`Department ${deletingDept.code} has been deleted.`);
      setDeletingDept(null);
    } catch {
      setError("Unable to delete department");
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
          departmentId: editingProgram.departmentId,
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

  const deleteGuarded = !!deletingDept && deletingDept.programCount > 0;

  return (
    <AdminShell title="Departments & Programs" subtitle="Academic Structure" active="/admin/setup">
      {/* Top bar */}
      <div className="admin-topbar">
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
          {loading
            ? "Loading…"
            : `${departments.length} department${departments.length !== 1 ? "s" : ""} · ${programs.length} program${programs.length !== 1 ? "s" : ""} registered`}
        </p>
        <div className="admin-topbar-actions">
          <button
            className="btn-add"
            type="button"
            onClick={() => { setShowCreateDept(true); setError(""); }}
          >
            <IconPlus size={15} aria-hidden="true" />
            Add Department
          </button>
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

      {/* Departments table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Department</th>
              <th>Programs</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="admin-table-empty">
                  No departments yet. Click <strong>Add Department</strong> to create one.
                </td>
              </tr>
            ) : (
              departments.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="badge badge-violet">{d.code}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td>
                    <span className="badge badge-slate">{d.programCount} program{d.programCount === 1 ? "" : "s"}</span>
                  </td>
                  <td>
                    <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-action-edit"
                        title="Edit Department"
                        aria-label="Edit Department"
                        onClick={() => {
                          setError("");
                          setDeptCodeTouched(true);
                          setEditingDept({ ...d });
                        }}
                      >
                        <IconPencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn-action-delete"
                        title="Delete Department"
                        aria-label="Delete Department"
                        onClick={() => {
                          setError("");
                          setDeletingDept(d);
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

      {/* Modal 1: Add Department */}
      {showCreateDept && (
        <AdminModal title="Add New Department" onClose={() => setShowCreateDept(false)}>
          <form className="modal-form" onSubmit={handleCreateDept}>
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
                    code: deptCodeTouched ? f.code : suggestDeptCode(e.target.value),
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
                onChange={(e) => {
                  setDeptCodeTouched(true);
                  setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() });
                }}
                required
              />
            </label>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", fontFamily: "Arial, sans-serif" }}>
              Departments group related programs — create one here before adding its programs.
            </p>
            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Department"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setShowCreateDept(false)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Edit Department */}
      {editingDept && (
        <AdminModal title={`Edit Department: ${editingDept.code}`} onClose={() => setEditingDept(null)}>
          <form className="modal-form" onSubmit={handleUpdateDept}>
            <label>
              Department Name
              <input
                type="text"
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                required
              />
            </label>
            <label>
              Department Code
              <input
                type="text"
                value={editingDept.code}
                onChange={(e) => setEditingDept({ ...editingDept, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", fontFamily: "Arial, sans-serif" }}>
              Renaming a department updates the department shown on all its programs.
            </p>
            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setEditingDept(null)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Delete Department Confirmation */}
      {deletingDept && (
        <AdminModal title={`Delete Department: ${deletingDept.code}`} onClose={() => setDeletingDept(null)}>
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete the department <strong>{deletingDept.name} ({deletingDept.code})</strong>?
            </p>
            {deleteGuarded ? (
              <p
                style={{
                  fontSize: "13px",
                  color: "#b45309",
                  background: "rgba(217, 119, 6, 0.1)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  margin: 0,
                }}
              >
                <IconAlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>
                  This department still has {deletingDept.programCount} program{deletingDept.programCount === 1 ? "" : "s"} attached.
                  Reassign or delete them first — the department cannot be removed until then.
                </span>
              </p>
            ) : (
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
                <span>This department has no programs attached and can be safely deleted.</span>
              </p>
            )}
            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              {!deleteGuarded && (
                <button className="btn-danger" type="button" onClick={handleDeleteDept} disabled={saving}>
                  {saving ? "Deleting…" : "Yes, Delete Department"}
                </button>
              )}
              <button className="btn-ghost" type="button" onClick={() => setDeletingDept(null)} disabled={saving}>
                {deleteGuarded ? "OK, I'll reassign programs first" : "Cancel"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Modal 4: Add Program */}
      {showCreateProgram && (
        <AdminModal title="Add New Program" onClose={() => setShowCreateProgram(false)}>
          <form className="modal-form" onSubmit={handleCreateProgram}>
            <label>
              Department
              <select
                value={programForm.departmentId}
                onChange={(e) => setProgramForm({ ...programForm, departmentId: e.target.value })}
                required
              >
                <option value="">Select a department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </label>
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
              Department
              <select
                value={editingProgram.departmentId ?? ""}
                onChange={(e) => setEditingProgram({ ...editingProgram, departmentId: e.target.value })}
                required
              >
                <option value="">Select a department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </label>
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
