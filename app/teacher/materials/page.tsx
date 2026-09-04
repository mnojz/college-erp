"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { MaterialForm, type MaterialSubmitValues } from "@/app/components/materials/MaterialForm";
import {
  formatBytes,
  formatDate,
  MATERIAL_TYPE_STYLE,
  materialTypeLabel,
  VISIBILITY_LABELS,
  type ProgramsMeta,
  type StudyMaterialDto,
} from "@/app/lib/materials-shared";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconLock,
  IconStarFilled,
  IconUpload,
} from "@tabler/icons-react";

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
  classes: {
    id: string;
    semester: number;
    subject: { id: string; name: string; code: string };
    program: { id: string; name: string; code: string };
  }[];
};

type ClassGroup = { key: string; label: string; classIds: string[] };

export default function TeacherMaterialsPage() {
  const router = useRouter();
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [materials, setMaterials] = useState<StudyMaterialDto[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({ departments: [], programs: [], subjects: [], teachers: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<StudyMaterialDto | null>(null);
  const [deleting, setDeleting] = useState<StudyMaterialDto | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch("/api/teacher/profile");
        if (profileRes.status === 401 || profileRes.status === 403) {
          router.replace("/dashboard");
          return;
        }
        const [materialsRes, metaRes] = await Promise.all([
          fetch("/api/materials?mine=1"),
          fetch("/api/materials/meta"),
        ]);
        if (!materialsRes.ok || !metaRes.ok) {
          setLoadError("Unable to load your uploads");
          return;
        }
        const profileData = await profileRes.json();
        const materialsData = await materialsRes.json();
        const metaData = await metaRes.json();

        setTeacherInfo(profileData.teacher);
        setMaterials(materialsData.materials ?? []);
        setMeta({
          departments: metaData.departments ?? [],
          programs: metaData.programs ?? [],
          subjects: metaData.subjects ?? [],
          teachers: metaData.teachers ?? [],
        });
      } catch {
        setLoadError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  /** Teaching groups (deduped by subject+program+semester across schedule slots). */
  const classGroups: ClassGroup[] = useMemo(() => {
    if (!teacherInfo?.classes?.length) return [];
    const groups = new Map<string, ClassGroup>();
    for (const c of teacherInfo.classes) {
      const key = `${c.subject.id}__${c.program.id}__${c.semester}`;
      const existing = groups.get(key);
      if (existing) {
        existing.classIds.push(c.id);
      } else {
        groups.set(key, {
          key,
          label: `${c.subject.code} — ${c.program.code} · Semester ${c.semester}`,
          classIds: [c.id],
        });
      }
    }
    return [...groups.values()];
  }, [teacherInfo]);

  const totalStorage = useMemo(() => materials.reduce((sum, m) => sum + m.fileSize, 0), [materials]);
  const totalBookmarks = useMemo(() => materials.reduce((sum, m) => sum + m.bookmarkCount, 0), [materials]);

  function buildFormData(values: MaterialSubmitValues): FormData {
    const fd = new FormData();
    fd.set("title", values.title);
    if (values.description) fd.set("description", values.description);
    if (values.topic) fd.set("topic", values.topic);
    fd.set("materialType", values.materialType);
    fd.set("visibility", values.visibility);
    if (values.departmentName) fd.set("departmentName", values.departmentName);
    if (values.programId) fd.set("programId", values.programId);
    if (values.semester) fd.set("semester", values.semester);
    if (values.subjectId) fd.set("subjectId", values.subjectId);
    fd.set("classIds", JSON.stringify(values.classIds));
    return fd;
  }

  async function refreshMaterials() {
    const res = await fetch("/api/materials?mine=1");
    if (res.ok) {
      const data = await res.json();
      setMaterials(data.materials ?? []);
    }
  }

  async function handleCreate(values: MaterialSubmitValues) {
    setFormError("");
    setSaving(true);
    try {
      const fd = buildFormData(values);
      if (values.file) fd.set("file", values.file);
      const res = await fetch("/api/materials", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to upload material");
        return;
      }
      await refreshMaterials();
      setShowCreateModal(false);
      setMessage(`"${values.title}" is now available in the study library.`);
    } catch {
      setFormError("Failed to upload material");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(values: MaterialSubmitValues) {
    if (!editing) return;
    setFormError("");
    setSaving(true);
    try {
      const fd = buildFormData(values);
      if (values.file) fd.set("file", values.file);
      const res = await fetch(`/api/materials/${editing.id}`, { method: "PATCH", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to update material");
        return;
      }
      await refreshMaterials();
      setEditing(null);
      setMessage(`"${values.title}" has been updated.`);
    } catch {
      setFormError("Failed to update material");
    } finally {
      setSaving(false);
    }
  }


  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/materials/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to delete material");
        return;
      }
      setMaterials((list) => list.filter((m) => m.id !== deleting.id));
      setDeleting(null);
      setMessage(`Deleted "${deleting.title}".`);
    } catch {
      setFormError("Failed to delete material");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <main className="profile-error">{loadError}</main>;
  if (loading || !teacherInfo) return <main className="profile-loading">Loading your uploads…</main>;

  const typeStyle = (m: StudyMaterialDto) => MATERIAL_TYPE_STYLE[m.materialType] ?? MATERIAL_TYPE_STYLE.OTHER;

  return (
    <TeacherShell
      active="/teacher/materials"
      title="My Uploads — Notes & Study Material"
      subtitle="Faculty Study Library"
      teacherName={`${teacherInfo.firstName} ${teacherInfo.lastName}`}
      employeeNo={teacherInfo.employeeNo}
      avatarUrl={teacherInfo.profileImageUrl}
    >
      <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
        <article className="admin-metric-card">
          <span>Total Uploads</span>
          <strong>{materials.length}</strong>
          <small>Materials in the library</small>
        </article>
        <article className="admin-metric-card">
          <span>Storage Used</span>
          <strong>{formatBytes(totalStorage)}</strong>
          <small>Across all files</small>
        </article>
        <article className="admin-metric-card">
          <span>Bookmarks Received</span>
          <strong>{totalBookmarks}</strong>
          <small>Saves by students</small>
        </article>
        <article className="admin-metric-card">
          <span style={{ display: "block", marginBottom: "10px" }}>Share Material</span>
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              setFormError("");
              setShowCreateModal(true);
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <IconUpload size={15} aria-hidden="true" /> Upload Material
            </span>
          </button>
        </article>
      </section>

      {message && (
        <p className="notes-success-banner" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconCircleCheck size={16} aria-hidden="true" style={{ flexShrink: 0 }} /> {message}
        </p>
      )}

      {materials.length === 0 ? (
        <div className="profile-info-card notes-empty">
          <h3>No uploads yet</h3>
          <p>
            Upload lecture notes, slides, question banks, lab manuals or past papers. Academic metadata you add helps
            students discover material automatically through their &ldquo;My Subjects&rdquo; feed.
          </p>
        </div>
      ) : (
        <div className="notes-upload-list">
          {materials.map((m) => {
            const style = typeStyle(m);
            return (
              <article key={m.id} className="upload-row">
                <span className="note-monogram" style={{ background: style.bg, color: style.color }}>
                  {style.monogram}
                </span>
                <div className="upload-row-main">
                  <h4>{m.title}</h4>
                  <div className="note-card-chips">
                    <span className="type-pill" style={{ background: style.bg, color: style.color }}>
                      {materialTypeLabel(m.materialType)}
                    </span>
                    {m.subject && <span className="chip chip-sky">{m.subject.code}</span>}
                    {m.topic && <span className="chip">{m.topic}</span>}
                    {m.semester != null && <span className="chip">Sem {m.semester}</span>}
                    <span className={`chip chip-visibility-${m.visibility.toLowerCase()}`}>
                      <IconLock size={12} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "4px" }} />
                      {VISIBILITY_LABELS[m.visibility] ?? m.visibility}
                    </span>
                  </div>
                  <small className="upload-row-meta">
                    {m.fileName} · {formatBytes(m.fileSize)} · Uploaded {formatDate(m.createdAt)} ·{" "}
                    <IconStarFilled size={12} aria-hidden="true" style={{ verticalAlign: "-2px" }} />{" "}
                    {m.bookmarkCount} bookmark{m.bookmarkCount === 1 ? "" : "s"}
                  </small>
                </div>
                <div className="upload-row-actions">
                  <a className="btn-ghost btn-small" href={`/api/materials/${m.id}/file`}>
                    Download
                  </a>
                  <button
                    className="btn-ghost btn-small"
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setEditing(m);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-danger-ghost btn-small"
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setDeleting(m);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal 1: Upload new material */}
      {showCreateModal && (
        <AdminModal title="Upload Study Material" onClose={() => setShowCreateModal(false)}>
          <MaterialForm
            mode="create"
            meta={meta}
            classGroups={classGroups}
            submitting={saving}
            error={formError}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateModal(false)}
          />
        </AdminModal>
      )}

      {/* Modal 2: Edit existing upload */}
      {editing && (
        <AdminModal title="Edit Study Material" onClose={() => setEditing(null)}>
          <MaterialForm
            mode="edit"
            initial={{
              title: editing.title,
              description: editing.description,
              topic: editing.topic,
              materialType: editing.materialType,
              visibility: editing.visibility,
              departmentName: editing.departmentName,
              programId: editing.program?.id ?? null,
              semester: editing.semester,
              subjectId: editing.subject?.id ?? null,
            }}
            meta={meta}
            classGroups={classGroups}
            submitting={saving}
            error={formError}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </AdminModal>
      )}

      {/* Modal 3: Delete confirmation */}
      {deleting && (
        <AdminModal title="Delete Study Material" onClose={() => setDeleting(null)}>
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete <strong>&ldquo;{deleting.title}&rdquo;</strong>?
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--danger)",
                background: "var(--danger-soft)",
                padding: "10px 14px",
                borderRadius: "8px",
              }}
            >
              <span style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <IconAlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
                Students will immediately lose access to this file, including existing bookmarks.
              </span>
            </p>
            {formError && <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--danger-ink)" }}>{formError}</p>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-danger" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setDeleting(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </TeacherShell>
  );
}



