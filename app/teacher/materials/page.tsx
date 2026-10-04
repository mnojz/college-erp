"use client";
import { Button } from "@/components/ui/button";

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
  IconDownload,
  IconLock,
  IconPencil,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";

type TeacherInfo = {
  user: { firstName: string; lastName: string };
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

  function buildFormData(values: MaterialSubmitValues): FormData {
    const fd = new FormData();
    fd.set("title", values.title);
    if (values.description) fd.set("description", values.description);
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

  if (loadError) return <main className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-destructive">{loadError}</main>;
  if (loading || !teacherInfo) return <main className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">Loading your uploads…</main>;

  const typeStyle = (m: StudyMaterialDto) => MATERIAL_TYPE_STYLE[m.materialType] ?? MATERIAL_TYPE_STYLE.OTHER;

  return (
    <TeacherShell
      active="/teacher/materials"
      title="My Uploads — Notes & Study Material"
      subtitle="Faculty Study Library"
      teacherName={teacherInfo ? `${teacherInfo.user.firstName} ${teacherInfo.user.lastName}` : undefined}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
      headerActions={
        <Button
          type="button"
          onClick={() => {
            setFormError("");
            setShowCreateModal(true);
          }}
        >
          <IconUpload size={16} aria-hidden="true" /> Upload Material
        </Button>
      }
    >
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Total Uploads</span>
          <strong>{materials.length}</strong>
          <small>Materials in the library</small>
        </article>
        <article className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-5 shadow-xs [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-wide [&>span]:text-muted-foreground [&>strong]:my-1 [&>strong]:text-[34px] [&>strong]:font-bold [&>strong]:leading-none [&>strong]:tracking-tight [&>small]:text-xs [&>small]:text-muted-foreground">
          <span>Storage Used</span>
          <strong>{formatBytes(totalStorage)}</strong>
          <small>Across all files</small>
        </article>
      </section>

      {message && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconCircleCheck size={16} aria-hidden="true" style={{ flexShrink: 0 }} /> {message}
        </p>
      )}

      {materials.length === 0 ? (
        <div className="rounded-xl border bg-card p-5 px-8 py-10 text-center shadow-xs [&>h3]:m-0 [&>h3]:mb-2 [&>h3]:text-base [&>h3]:font-bold [&>p]:text-sm [&>p]:leading-relaxed [&>p]:text-muted-foreground">
          <h3>No uploads yet</h3>
          <p>
            Upload lecture notes, slides, question banks, lab manuals or past papers. Academic metadata you add helps
            students discover material automatically through their &ldquo;My Subjects&rdquo; feed.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {materials.map((m) => {
            const style = typeStyle(m);
            return (
              <article key={m.id} className="flex items-center gap-4 rounded-lg border bg-background px-3.5 py-2.5 transition-colors hover:bg-muted/40 max-sm:flex-col max-sm:items-start">
                <span className={`inline-grid size-10 shrink-0 place-items-center rounded-[10px] text-[13px] font-extrabold ${style.tint}`}>
                  {style.monogram}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="m-0 text-[13px] font-semibold">{m.title}</h4>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.tint}`}>
                      {materialTypeLabel(m.materialType)}
                    </span>
                    {m.subject && <span className="inline-block rounded-full bg-[color-mix(in_oklab,var(--ctp-sky)_15%,transparent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ctp-sky)]">{m.subject.code}</span>}
                    {m.semester != null && <span className="inline-block rounded-full bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ctp-green)]">Sem {m.semester}</span>}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.visibility === "EVERYONE" ? "bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-[var(--ctp-green)]" : "bg-[color-mix(in_oklab,var(--ctp-yellow)_15%,transparent)] text-[var(--ctp-yellow)]"}`}>
                      <IconLock size={12} aria-hidden="true" />
                      {VISIBILITY_LABELS[m.visibility] ?? m.visibility}
                    </span>
                  </div>
                  <small className="mt-0.5 block text-xs text-muted-foreground">
                    {m.fileName} · {formatBytes(m.fileSize)} · Uploaded {formatDate(m.createdAt)}
                  </small>
                </div>
                <div className="ml-auto flex shrink-0 gap-1.5 max-sm:ml-0 max-sm:w-full max-sm:justify-end">
                  <Button asChild variant="outline" size="icon-sm" title="Download" aria-label={`Download ${m.title}`}>
                    <a href={`/api/materials/${m.id}/file`}>
                      <IconDownload size={15} aria-hidden="true" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    type="button"
                    title="Edit"
                    aria-label={`Edit ${m.title}`}
                    onClick={() => {
                      setFormError("");
                      setEditing(m);
                    }}
                  >
                    <IconPencil size={15} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    type="button"
                    title="Delete"
                    aria-label={`Delete ${m.title}`}
                    onClick={() => {
                      setFormError("");
                      setDeleting(m);
                    }}
                  >
                    <IconTrash size={15} aria-hidden="true" />
                  </Button>
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
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>
              Are you sure you want to delete <strong>&ldquo;{deleting.title}&rdquo;</strong>?
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--destructive)",
                background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
                padding: "10px 14px",
                borderRadius: "8px",
              }}
            >
              <span style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <IconAlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
                Students will immediately lose access to this file, including existing bookmarks.
              </span>
            </p>
            {formError && <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--destructive)" }}>{formError}</p>}
            <div className="flex flex-wrap justify-end gap-2.5" style={{ marginTop: "20px" }}>
              <Button variant="destructive" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setDeleting(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
    </TeacherShell>
  );
}



