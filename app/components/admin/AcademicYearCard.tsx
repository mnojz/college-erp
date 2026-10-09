"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AdminModal } from "@/app/components/admin/AdminModal";
import {
  IconPencil,
  IconTrash,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconLock,
  IconLockOpen,
  IconAlertTriangle,
} from "@tabler/icons-react";

type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: "ACTIVE" | "CLOSED";
  minAttendancePercent: number;
  _count?: { semesters: number };
};

type YearForm = {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  minAttendancePercent: string;
};

const emptyForm: YearForm = {
  name: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  minAttendancePercent: "75",
};

function toDateInput(iso: string): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

/**
 * Manage academic years — the records that progression, attendance policy and
 * enrollment history all key off. The /api/academic-years endpoints already
 * support full CRUD (set-current, close, guarded delete); this is their UI.
 */
export function AcademicYearCard() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<YearForm>(emptyForm);

  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [editForm, setEditForm] = useState<YearForm>(emptyForm);

  const [deleting, setDeleting] = useState<AcademicYear | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/academic-years?pageSize=50");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to load academic years");
        return;
      }
      setYears(data.academicYears ?? []);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sync = setTimeout(() => void load(), 0);
    return () => clearTimeout(sync);
  }, [load]);

  function percentIsValid(p: string): boolean {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 100;
  }

  function datesAreValid(f: YearForm): boolean {
    if (!f.name.trim() || !f.startDate || !f.endDate) return false;
    return new Date(f.endDate) > new Date(f.startDate);
  }

  async function createYear() {
    setError("");
    if (!datesAreValid(createForm)) {
      setError("Name and a valid start/end date range are required (end must be after start).");
      return;
    }
    if (!percentIsValid(createForm.minAttendancePercent)) {
      setError("Attendance percent must be a whole number between 0 and 100.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          startDate: createForm.startDate,
          endDate: createForm.endDate,
          isCurrent: createForm.isCurrent,
          minAttendancePercent: Number(createForm.minAttendancePercent),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to create academic year");
        return;
      }
      setMessage(`Academic year ${data.academicYear.name} created.`);
      setShowCreate(false);
      setCreateForm(emptyForm);
      await load();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(y: AcademicYear) {
    setError("");
    setMessage("");
    setEditing(y);
    setEditForm({
      name: y.name,
      startDate: toDateInput(y.startDate),
      endDate: toDateInput(y.endDate),
      isCurrent: y.isCurrent,
      minAttendancePercent: String(y.minAttendancePercent ?? 75),
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setError("");
    if (!datesAreValid(editForm)) {
      setError("Name and a valid start/end date range are required (end must be after start).");
      return;
    }
    if (!percentIsValid(editForm.minAttendancePercent)) {
      setError("Attendance percent must be a whole number between 0 and 100.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/academic-years", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          name: editForm.name.trim(),
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          minAttendancePercent: Number(editForm.minAttendancePercent),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to update academic year");
        return;
      }
      setMessage(`Academic year ${data.academicYear.name} updated.`);
      setEditing(null);
      await load();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setBusy(false);
    }
  }

  /** Set-current / close / reopen are single-field PATCHes to the same endpoint. */
  async function patch(y: AcademicYear, data: Record<string, unknown>, okMsg: string) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const res = await fetch("/api/academic-years", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: y.id, ...data }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Unable to update academic year");
        return;
      }
      setMessage(okMsg);
      await load();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function deleteYear() {
    if (!deleting) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/academic-years?id=${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to delete academic year");
        return;
      }
      setMessage(`Academic year ${deleting.name} deleted.`);
      setDeleting(null);
      await load();
    } catch {
      setError("Unable to delete academic year");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-5">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Academic Years</CardTitle>
        <Button type="button" size="sm" onClick={() => { setError(""); setMessage(""); setShowCreate(true); }}>
          <IconPlus size={15} aria-hidden="true" />
          Add Year
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="m-0 text-sm text-muted-foreground">Loading academic years…</p>
        ) : (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-muted-foreground">
              The current year receives new enrollment history when cohorts are promoted. Exactly one
              year can be current at a time.
            </p>

            {years.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                No academic years yet. Click <strong>Add Year</strong> to create one.
              </p>
            ) : (
              <div className="w-full overflow-x-auto rounded-lg border">
                <table className="w-full text-sm [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:text-left [&_th]:align-middle [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-muted/40">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Dates</th>
                      <th>Status</th>
                      <th>Attendance</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((y) => (
                      <tr key={y.id} className={y.status === "CLOSED" ? "opacity-60" : undefined}>
                        <td className="font-semibold">
                          {y.name}
                          {y.isCurrent && (
                            <Badge
                              className="ml-2 align-middle bg-[color-mix(in_oklab,var(--ctp-yellow)_18%,transparent)] text-[var(--ctp-yellow)]"
                              title="Receives new enrollment history on promotion"
                            >
                              Current
                            </Badge>
                          )}
                        </td>
                        <td className="text-muted-foreground">
                          {toDateInput(y.startDate)} → {toDateInput(y.endDate)}
                        </td>
                        <td>
                          {y.status === "ACTIVE" ? (
                            <Badge className="bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-[var(--ctp-green)]">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Closed</Badge>
                          )}
                        </td>
                        <td className="text-muted-foreground">{y.minAttendancePercent}%</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              title={y.isCurrent ? "Current year" : "Make this the current year"}
                              aria-label="Set as current year"
                              disabled={busy || y.isCurrent}
                              onClick={() => void patch(y, { isCurrent: true }, `${y.name} is now the current year.`)}
                            >
                              {y.isCurrent ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              title={y.status === "ACTIVE" ? "Close year (read-only)" : "Reopen year"}
                              aria-label={y.status === "ACTIVE" ? "Close year" : "Reopen year"}
                              disabled={busy}
                              onClick={() =>
                                void patch(
                                  y,
                                  { status: y.status === "ACTIVE" ? "CLOSED" : "ACTIVE" },
                                  `${y.name} ${y.status === "ACTIVE" ? "closed" : "reopened"}.`,
                                )
                              }
                            >
                              {y.status === "ACTIVE" ? <IconLock size={15} /> : <IconLockOpen size={15} />}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              title="Edit Year"
                              aria-label="Edit Year"
                              disabled={busy}
                              onClick={() => openEdit(y)}
                            >
                              <IconPencil size={15} />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                              title="Delete permanently — only allowed if unused"
                              aria-label="Delete Year"
                              disabled={busy}
                              onClick={() => { setError(""); setMessage(""); setDeleting(y); }}
                            >
                              <IconTrash size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            {message && !error && <p className="m-0 text-[13px] text-[var(--ctp-green)]">{message}</p>}
          </div>
        )}
      </CardContent>

      {/* Create */}
      {showCreate && (
        <AdminModal title="Add Academic Year" onClose={() => setShowCreate(false)}>
          <div className="grid gap-4">
            <label className="form-field">
              Year Name
              <input
                className="form-control"
                type="text"
                placeholder="e.g. 2025/2026"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-field">
                Start Date
                <input
                  className="form-control"
                  type="date"
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                />
              </label>
              <label className="form-field">
                End Date
                <input
                  className="form-control"
                  type="date"
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                />
              </label>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-year-attendance">Minimum attendance (%)</Label>
              <Input
                id="create-year-attendance"
                type="number"
                min={0}
                max={100}
                step={1}
                value={createForm.minAttendancePercent}
                onChange={(e) => setCreateForm({ ...createForm, minAttendancePercent: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.isCurrent}
                onChange={(e) => setCreateForm({ ...createForm, isCurrent: e.target.checked })}
              />
              Make this the current year (demotes the previous one)
            </label>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="button" disabled={busy} onClick={() => void createYear()}>
                {busy ? "Creating…" : "Create Year"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}


      {/* Edit */}
      {editing && (
        <AdminModal title={`Edit Academic Year: ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="grid gap-4">
            <label className="form-field">
              Year Name
              <input
                className="form-control"
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-field">
                Start Date
                <input
                  className="form-control"
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </label>
              <label className="form-field">
                End Date
                <input
                  className="form-control"
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
              </label>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-year-attendance">Minimum attendance (%)</Label>
              <Input
                id="edit-year-attendance"
                type="number"
                min={0}
                max={100}
                step={1}
                value={editForm.minAttendancePercent}
                onChange={(e) => setEditForm({ ...editForm, minAttendancePercent: e.target.value })}
              />
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              To change which year is current or its open/closed status, use the star and lock buttons
              in the table.
            </p>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="button" disabled={busy} onClick={() => void saveEdit()}>
                {busy ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}


      {/* Delete confirm */}
      {deleting && (
        <AdminModal title={`Delete Academic Year: ${deleting.name}`} onClose={() => setDeleting(null)}>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>
              Permanently delete the academic year <strong>{deleting.name}</strong>?
            </p>
            <p className="m-0 flex items-start gap-2 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
              <IconAlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                This cannot be undone. If any enrollment records reference this year, the server will
                refuse the deletion and tell you how many.
              </span>
            </p>
            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <Button variant="destructive" type="button" onClick={() => void deleteYear()} disabled={busy}>
                {busy ? "Deleting…" : "Yes, Delete Year"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
    </Card>
  );
}

