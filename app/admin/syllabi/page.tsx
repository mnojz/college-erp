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
  const [filterDept, setFilterDept] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/");
          return;
        }
      } catch {
        router.replace("/");
        return;
      }

      try {
        const [listRes, metaRes] = await Promise.all([
          fetch("/api/syllabi"),
          fetch("/api/syllabi/meta"),
        ]);
        if (!listRes.ok) throw new Error("Unable to load syllabi");
        const listData = await listRes.json();
        setSyllabi(listData.syllabi ?? []);
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setMeta({
            departments: metaData.departments ?? [],
            programs: metaData.programs ?? [],
          });
          if (metaData.departments?.length) setFilterDept(metaData.departments[0]);
        }
      } catch (err) {
        setError((err as Error).message ?? "Unable to load syllabi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const departmentPrograms = useMemo(() => {
    if (!filterDept) return meta.programs;
    return meta.programs.filter((p) => p.departmentName === filterDept);
  }, [meta.programs, filterDept]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return syllabi.filter((s) => {
      if (filterDept && s.departmentName !== filterDept) return false;
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
  }, [syllabi, q, filterDept, filterProgram, filterSemester]);

        const groups: GroupedByDepartment[] = useSyllabusGroups(filtered, meta.programs);

  async function handleCreate(values: SyllabusSubmitValues) {
    setFormError("");
    setMessage("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", values.title);
      fd.append("departmentName", values.departmentName);
      fd.append("programId", values.programId);
      fd.append("semester", values.semester);
      if (values.file) fd.append("file", values.file);

      const res = await fetch("/api/syllabi", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to upload syllabus");
      const created: Syllabus = data.syllabus as Syllabus;
      setSyllabi((p) => [created, ...p]);
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
      fd.append("departmentName", values.departmentName);
      fd.append("programId", values.programId);
      fd.append("semester", values.semester);
      if (values.file) fd.append("file", values.file);

      const res = await fetch(`/api/syllabi/${editing.id}`, { method: "PATCH", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update syllabus");
      setSyllabi((p) =>
        p.map((s) =>
          s.id === editing.id
            ? {
                ...s,
                title: values.title,
                departmentName: values.departmentName,
                programId: values.programId || null,
                semester: Number(values.semester),
                ...(values.file
                  ? { fileName: values.file.name, fileSize: values.file.size }
                  : {}),
              }
            : s,
        ),
      );
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
      const res = await fetch(`/api/syllabi/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to delete syllabus");
      setSyllabi((p) => p.filter((s) => s.id !== deleting.id));
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
    setFilterDept("");
    setFilterProgram("");
    setFilterSemester("");
  }

  if (loading) {
    return (
      <AdminShell
        title="Syllabi"
        subtitle="Program syllabi library"
        active="/admin/syllabi"
      >
        <p>Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Syllabi"
      subtitle="Program syllabi library"
      active="/admin/syllabi"
    >
      <div>
        {message && <p className="notes-success-banner">{message}</p>}
        {error && <p className="notes-form-error">{error}</p>}

        {/* Metrics */}
        <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
          <div className="admin-metric-card">
            <span>Total Syllabi</span>
            <strong>{syllabi.length}</strong>
          </div>
          <div className="admin-metric-card">
            <span>Departments</span>
            <strong>{groups.length}</strong>
          </div>
          <div className="admin-metric-card">
            <span>Filtered</span>
            <strong>{filtered.length}</strong>
          </div>
        </section>

        {/* Toolbar */}
        <div
          style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}
        >
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError("");
              setShowCreateModal(true);
            }}
          >
            + Upload Syllabus
          </button>
          <SyllabusToolbar
            meta={meta}
            q={q}
            filterDept={filterDept}
            filterProgram={filterProgram}
            filterSemester={filterSemester}
            departmentPrograms={departmentPrograms}
            onChange={(p) => {
              if (p.q !== undefined) setQ(p.q);
              if (p.filterDept !== undefined) setFilterDept(p.filterDept);
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
            <h3>No syllabi found</h3>
            <p>
              {syllabi.length === 0
                ? "No syllabi have been uploaded yet. Click \u201cUpload Syllabus\u201d to get started."
                : "No syllabi match the selected filters. Try adjusting your search or filters."}
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
                departmentName: editing.departmentName,
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
                  fontSize: "13px",
                  color: "#dc2626",
                  background: "rgba(220, 38, 38, 0.08)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                }}
              >
                ⚠️ This PDF will be immediately removed and no longer downloadable by students.
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

