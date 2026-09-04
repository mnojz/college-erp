"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { SyllabusForm, type SyllabusSubmitValues } from "@/app/components/syllabi/SyllabusForm";
import { SyllabusToolbar } from "@/app/components/syllabi/SyllabusToolbar";
import {
  useSyllabusGroups,
  type GroupedByDepartment,
} from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusGroupedView } from "@/app/components/syllabi/SyllabusGroupedView";
import {
  resolveTitle,
  type ProgramsMeta,
  type SyllabusDto,
} from "@/app/lib/syllabi-shared";
import { IconPlus, IconAlertTriangle } from "@tabler/icons-react";

type Syllabus = SyllabusDto;

export default function AdminSyllabiPage() {
  const router = useRouter();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({
    departments: [],
    programs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<Syllabus | null>(null);
  const [deleting, setDeleting] = useState<Syllabus | null>(null);

  // Search + filters
  const [q, setQ] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [listRes, metaRes] = await Promise.all([
      fetch("/api/syllabus"),
      fetch("/api/syllabus/meta"),
    ]);
    if (!listRes.ok) throw new Error("Unable to load syllabus");
    const listData = await listRes.json();
    setSyllabi(listData.syllabi ?? []);
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      setMeta({
        departments: metaData.departments ?? [],
        programs: metaData.programs ?? [],
      });
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
      } catch {
        router.replace("/dashboard");
        return;
      }

      try {
        await refresh();
      } catch (err) {
        setError((err as Error).message ?? "Unable to load syllabus");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return syllabi.filter((s) => {
      if (filterProgram && s.programId !== filterProgram) return false;
      if (filterSemester) {
        if (s.semester !== Number.parseInt(filterSemester, 10)) return false;
      }
      if (term) {
        const haystack = `${s.title ?? ""} ${s.fileName} ${s.departmentName} ${s.programCode ?? ""} ${s.programName ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [syllabi, q, filterProgram, filterSemester]);

  const groups: GroupedByDepartment[] = useSyllabusGroups(filtered, meta.programs);

  async function handleCreate(values: SyllabusSubmitValues) {
    setFormError("");
    setMessage("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", values.title);
      fd.append("departmentName", meta.departments[0] ?? "");
      fd.append("programId", values.programId);
      fd.append("semester", values.semester);
      if (values.file) fd.append("file", values.file);

      const res = await fetch("/api/syllabus", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to upload syllabus");
      // The POST response only returns { id } — refetch so the list always
      // holds complete rows (an optimistic prepend of a partial object
      // previously crashed grouping and produced undefined React keys).
      await refresh();
      setShowCreateModal(false);
      setMessage("Syllabus uploaded successfully.");
    } catch (err) {
      setFormError((err as Error).message ?? "Unable to upload syllabus");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(values: SyllabusSubmitValues) {
    if (!editing) return;
    setFormError("");
    setMessage("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", values.title);
      fd.append("departmentName", meta.departments[0] ?? "");
      fd.append("programId", values.programId);
      fd.append("semester", values.semester);
      if (values.file) fd.append("file", values.file);

      const res = await fetch(`/api/syllabus/${editing.id}`, { method: "PATCH", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update syllabus");
      await refresh();
      setEditing(null);
      setMessage("Syllabus updated successfully.");
    } catch (err) {
      setFormError((err as Error).message ?? "Unable to update syllabus");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/syllabus/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to delete syllabus");
      await refresh();
      setDeleting(null);
      setMessage("Syllabus deleted.");
    } catch (err) {
      setFormError((err as Error).message ?? "Unable to delete syllabus");
    } finally {
      setSaving(false);
    }
  }

  function resetFilters() {
    setQ("");
    setFilterProgram("");
    setFilterSemester("");
  }

  if (loading) {
    return (
      <AdminShell
        title="Syllabus"
        subtitle="Program syllabus library"
        active="/admin/syllabus"
      >
        <p>Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Syllabus"
      subtitle="Program syllabus library"
      active="/admin/syllabus"
    >
      <div>
        {/* Top bar */}
        <div className="admin-topbar">
          <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
            {`${syllabi.length} syllabus file${syllabi.length !== 1 ? "s" : ""} registered`}
          </p>
          <div className="admin-topbar-actions">
            <button
              type="button"
              className="btn-add"
              onClick={() => {
                setFormError("");
                setShowCreateModal(true);
              }}
            >
              <IconPlus size={15} aria-hidden="true" />
              Upload Syllabus
            </button>
          </div>
        </div>

        {message && <p className="notes-success-banner">{message}</p>}
        {error && <p className="notes-form-error">{error}</p>}

        {/* Metrics */}
        <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
          <div className="admin-metric-card">
            <span>Total Syllabus</span>
            <strong>{syllabi.length}</strong>
          </div>
          <div className="admin-metric-card">
            <span>Programs</span>
            <strong>{new Set(syllabi.map((s) => s.programId).filter(Boolean)).size}</strong>
          </div>
          <div className="admin-metric-card">
            <span>Showing</span>
            <strong>{filtered.length}</strong>
          </div>
        </section>

        {/* Search + filters */}
        <div style={{ marginBottom: "16px" }}>
          <SyllabusToolbar
            q={q}
            filterProgram={filterProgram}
            filterSemester={filterSemester}
            programs={meta.programs}
            onChange={(p) => {
              if (p.q !== undefined) setQ(p.q);
              if (p.filterProgram !== undefined) setFilterProgram(p.filterProgram);
              if (p.filterSemester !== undefined) setFilterSemester(p.filterSemester);
            }}
            onReset={resetFilters}
          />
        </div>

        {/* Grouped list */}
        <SyllabusGroupedView
          groups={groups}
          onEdit={(s) => setEditing(s)}
          onDelete={(s) => setDeleting(s)}
        />

        {filtered.length === 0 && !error && (
          <div className="profile-info-card notes-empty">
            <h3>No syllabus found</h3>
            <p>
              {syllabi.length === 0
                ? "No syllabus files have been uploaded yet. Click \u201cUpload Syllabus\u201d to get started."
                : "No syllabus files match the selected filters. Try adjusting your search or filters."}
            </p>
          </div>
        )}

        {/* Create modal */}
        {showCreateModal && (
          <AdminModal title="Upload Syllabus" onClose={() => setShowCreateModal(false)}>
            <SyllabusForm
              mode="create"
              meta={meta}
              submitting={saving}
              error={formError}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateModal(false)}
            />
          </AdminModal>
        )}

        {/* Edit modal */}
        {editing && (
          <AdminModal title="Edit Syllabus" onClose={() => setEditing(null)}>
            <SyllabusForm
              mode="edit"
              meta={meta}
              initial={{
                title: editing.title ?? "",
                programId: editing.programId ?? "",
                semester: String(editing.semester),
              }}
              submitting={saving}
              error={formError}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          </AdminModal>
        )}

        {/* Delete confirmation */}
        {deleting && (
          <AdminModal title="Delete Syllabus" onClose={() => setDeleting(null)}>
            <div className="modal-confirm-box">
              <p>
                Are you sure you want to delete <strong>&ldquo;{resolveTitle(deleting)}&rdquo;</strong>?
              </p>
              <p
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#dc2626",
                  background: "rgba(220, 38, 38, 0.08)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                }}
              >
                <IconAlertTriangle size={16} aria-hidden="true" />
                This PDF will be immediately removed and no longer downloadable by students.
              </p>
              {formError && (
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>
                  {formError}
                </p>
              )}
              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  {saving ? "Deleting…" : "Yes, Delete"}
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => setDeleting(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </AdminShell>
  );
}

