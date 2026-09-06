"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { Badge } from "@/components/ui/badge";
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 text-[13px] text-muted-foreground">
          {loading
            ? "Loading…"
            : `${department ? department.code : "Department not set yet"} · ${programs.length} program${programs.length !== 1 ? "s" : ""} registered`}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {!department && (
            <Button
              size="sm"
              type="button"
              onClick={() => { setDeptForm({ name: "", code: "" }); setShowSetDept(true); setError(""); }}
            >
              <IconPlus size={15} aria-hidden="true" />
              Set Department
            </Button>
          )}
          <Button
            size="sm"
            type="button"
            onClick={() => { setShowCreateProgram(true); setError(""); }}
          >
            <IconPlus size={15} aria-hidden="true" />
            Add Program
          </Button>
        </div>
      </div>

      {error && <p className="mt-3.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">{error}</p>}
      {message && <p className="mt-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400">{message}</p>}

      {/* Department card (single, one-time setup) */}
      {department ? (
        <div className="mb-7 flex flex-wrap items-center gap-3.5 rounded-[14px] border bg-card px-4.5 py-4">
          <Badge variant="secondary">
              {department.code}
            </Badge>
          <div>
            <p className="m-0 text-[15px] font-semibold text-foreground">
              {department.name} Department
            </p>
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
              Your department. All programs, subjects, classes and users are assigned to it automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="outline" size="icon-sm"
            className="ml-auto"
            title="Edit Department"
            aria-label="Edit Department"
            onClick={() => {
              setDeptForm({ name: department.name, code: department.code });
              setError("");
              setShowSetDept(true);
            }}
          >
            <IconPencil size={15} />
          </Button>
        </div>
      ) : (
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-dashed bg-card px-5 py-4.5">
          <div>
            <p className="m-0 text-[15px] font-semibold text-foreground">
              Set up your department once
            </p>
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
              Enter your department name and code — this is used across the entire system.
            </p>
          </div>
          <Button size="sm" type="button" onClick={() => { setDeptForm({ name: "", code: "" }); setShowSetDept(true); setError(""); }}>
            <IconPlus size={15} aria-hidden="true" />
            Set Department
          </Button>
        </div>
      )}

      {/* Programs table */}
      <div className="mt-7 w-full overflow-x-auto rounded-lg border">
        <table className="w-full text-sm [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:text-left [&_th]:align-middle [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-muted/40">
          <thead>
            <tr>
              <th>Code</th>
              <th>Program Name</th>
              <th>Department</th>
              <th>Duration</th>
              <th>Semesters</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No programs yet. Click <strong>Add Program</strong> to create one.
                </td>
              </tr>
            ) : (
              programs.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Badge variant="secondary">{p.code}</Badge>
                  </td>
                  <td className="font-semibold">{p.name}</td>
                  <td style={{ color: "var(--muted-foreground)" }}>{p.departmentName}</td>
                  <td>{p.durationYears} years</td>
                  <td>
                    <Badge variant="outline">{p.durationYears * 2} semesters</Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline" size="icon-sm"
                        title="Edit Program"
                        aria-label="Edit Program"
                        onClick={() => {
                          setError("");
                          setEditingProgram({ ...p, durationYearsStr: String(p.durationYears) });
                        }}
                      >
                        <IconPencil size={15} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline" size="icon-sm" className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                        title="Delete Program"
                        aria-label="Delete Program"
                        onClick={() => {
                          setError("");
                          setDeletingProgram(p);
                        }}
                      >
                        <IconTrash size={15} />
                      </Button>
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
          <form className="grid gap-4" onSubmit={handleSetDept}>
            <label className="form-field">
              Department Name
              <input
                className="form-control"
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
            <label className="form-field">
              Department Code
              <input
                className="form-control"
                type="text"
                placeholder="e.g. ENG"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <p className="m-0 text-xs text-muted-foreground">
              This is your institution&apos;s single department. It is assigned to every program, subject,
              class and user automatically. You can update the name or code later from the department card.
            </p>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="submit" disabled={saving}>
                {saving ? (department ? "Saving…" : "Setting…") : department ? "Save Changes" : "Set Department"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setShowSetDept(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Add Program */}
      {showCreateProgram && (
        <AdminModal title="Add New Program" onClose={() => setShowCreateProgram(false)}>
          <form className="grid gap-4" onSubmit={handleCreateProgram}>
            <label className="form-field">
              Program Name
              <input
                className="form-control"
                type="text"
                placeholder="e.g. B.E. Degree in Computer Engineering"
                value={programForm.name}
                onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                required
              />
            </label>
            <label className="form-field">
              Program Code (e.g. BCT)
              <input
                className="form-control"
                type="text"
                placeholder="BCT"
                value={programForm.code}
                onChange={(e) => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <label className="form-field">
              Duration (Years)
              <input
                className="form-control"
                type="number"
                min={1}
                max={6}
                value={programForm.durationYears}
                onChange={(e) => setProgramForm({ ...programForm, durationYears: e.target.value })}
                required
              />
            </label>
            <p className="m-0 text-xs text-muted-foreground">
              Total Semesters = duration × 2 (auto-calculated)
            </p>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Program"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setShowCreateProgram(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 5: Edit Program */}
      {editingProgram && (
        <AdminModal title={`Edit Program: ${editingProgram.code}`} onClose={() => setEditingProgram(null)}>
          <form className="grid gap-4" onSubmit={handleUpdateProgram}>
            <label className="form-field">
              Program Name
              <input
                className="form-control"
                type="text"
                value={editingProgram.name}
                onChange={(e) => setEditingProgram({ ...editingProgram, name: e.target.value })}
                required
              />
            </label>
            <label className="form-field">
              Program Code
              <input
                className="form-control"
                type="text"
                value={editingProgram.code}
                onChange={(e) => setEditingProgram({ ...editingProgram, code: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <label className="form-field">
              Duration (Years)
              <input
                className="form-control"
                type="number"
                min={1}
                max={6}
                value={editingProgram.durationYearsStr}
                onChange={(e) => setEditingProgram({ ...editingProgram, durationYearsStr: e.target.value })}
                required
              />
            </label>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setEditingProgram(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 6: Delete Program Confirmation */}
      {deletingProgram && (
        <AdminModal title={`Delete Program: ${deletingProgram.code}`} onClose={() => setDeletingProgram(null)}>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>
              Are you sure you want to delete the program <strong>{deletingProgram.name} ({deletingProgram.code})</strong>?
            </p>
            <p className="m-0 flex items-start gap-2 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
              <IconAlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>Deleting this program will remove all affiliated subjects, scheduled classes, assessments, and unassign enrolled students.</span>
            </p>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <Button variant="destructive" type="button" onClick={handleDeleteProgram} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Program"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setDeletingProgram(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
    </AdminShell>
  );
}
