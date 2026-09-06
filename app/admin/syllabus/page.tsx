"use client";
import { Button } from "@/components/ui/button";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { Skeleton } from "@/components/ui/skeleton";
import { SyllabusForm, type SyllabusSubmitValues } from "@/app/components/syllabi/SyllabusForm";
import { SyllabusToolbar } from "@/app/components/syllabi/SyllabusToolbar";
import { useSyllabusProgramGroups } from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusProgramSections } from "@/app/components/syllabi/SyllabusProgramSections";
import {
  formatBytes,
  MAX_SYLLABUS_BYTES,
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
  const [createPreset, setCreatePreset] = useState<Partial<SyllabusSubmitValues> | undefined>(
    undefined,
  );
  const [editing, setEditing] = useState<Syllabus | null>(null);
  const [deleting, setDeleting] = useState<Syllabus | null>(null);

  // Search + filters
  const [q, setQ] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  /** Empty slot currently receiving a direct drop-upload (drives the slot spinner). */
  const [uploadingSlot, setUploadingSlot] = useState<{
    programId: string | null;
    semester: number;
  } | null>(null);

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

  const groups = useSyllabusProgramGroups(filtered, meta.programs);

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
      setCreatePreset(undefined);
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

  /** Open the upload modal, optionally pre-filled from an empty semester slot. */
  function openCreate(preset?: Partial<SyllabusSubmitValues>) {
    setFormError("");
    setCreatePreset(preset);
    setShowCreateModal(true);
  }

  /** Empty semester slot: click opens a pre-filled modal; dropping a PDF uploads it directly. */
  function handleSlotAdd(programId: string | null, semester: number, file?: File) {
    if (!file) {
      openCreate({ programId: programId ?? "", semester: String(semester) });
      return;
    }
    void uploadSlotFile(programId, semester, file);
  }

  /** Direct-to-slot upload used when a PDF is dropped onto an empty semester slot. */
  async function uploadSlotFile(programId: string | null, semester: number, file: File) {
    setMessage("");
    setError("");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files can be uploaded as syllabus.");
      return;
    }
    if (file.size > MAX_SYLLABUS_BYTES) {
      setError(`That file is too large — the maximum size is ${formatBytes(MAX_SYLLABUS_BYTES)}.`);
      return;
    }
    setSaving(true);
    setUploadingSlot({ programId, semester });
    try {
      const fd = new FormData();
      // Title intentionally omitted (optional server-side): the library falls
      // back to the file name until an admin edits the entry.
      fd.append("departmentName", meta.departments[0] ?? "");
      fd.append("programId", programId ?? "");
      fd.append("semester", String(semester));
      fd.append("file", file);

      const res = await fetch("/api/syllabus", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to upload syllabus");
      await refresh();
      setMessage("Syllabus uploaded successfully.");
    } catch (err) {
      setError((err as Error).message ?? "Unable to upload syllabus");
    } finally {
      setSaving(false);
      setUploadingSlot(null);
    }
  }

  if (loading) {
    return (
      <AdminShell
        title="Syllabus"
        subtitle="Program syllabus library"
        active="/admin/syllabus"
      >
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 text-[13px] text-muted-foreground">
            {`${syllabi.length} syllabus file${syllabi.length !== 1 ? "s" : ""} registered`}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              size="sm"
              onClick={() => openCreate()}
            >
              <IconPlus size={15} aria-hidden="true" />
              Upload Syllabus
            </Button>
          </div>
        </div>

        {message && <p className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400">{message}</p>}
        {error && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive">{error}</p>}

        {/* Search + filters */}
        <div className="mb-5">
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

        {/* Program sections — one card per program, shared with student/public views */}
        {filtered.length > 0 ? (
          <SyllabusProgramSections
            variant="admin"
            groups={groups}
            onEdit={setEditing}
            onDelete={setDeleting}
            onAdd={handleSlotAdd}
            uploading={uploadingSlot}
          />
        ) : (
          !error && (
            <div className="rounded-xl border border-dashed bg-card px-8 py-12 text-center">
              <h3 className="mb-2 text-base font-semibold">No syllabus found</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {syllabi.length === 0
                  ? "No syllabus files have been uploaded yet. Click “Upload Syllabus” to get started."
                  : "No syllabus files match the selected filters. Try adjusting your search or filters."}
              </p>
            </div>
          )
        )}

        {/* Create modal */}
        {showCreateModal && (
          <AdminModal title="Upload Syllabus" wide onClose={() => setShowCreateModal(false)}>
            <SyllabusForm
              mode="create"
              meta={meta}
              initial={createPreset}
              submitting={saving}
              error={formError}
              onSubmit={handleCreate}
              onCancel={() => {
                setShowCreateModal(false);
                setCreatePreset(undefined);
              }}
            />
          </AdminModal>
        )}

        {/* Edit modal */}
        {editing && (
          <AdminModal title="Edit Syllabus" wide onClose={() => setEditing(null)}>
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
            <div className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Are you sure you want to delete <strong>&ldquo;{resolveTitle(deleting)}&rdquo;</strong>?
              </p>
              <p className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive dark:border-destructive/40 dark:bg-destructive/20">
                <IconAlertTriangle size={16} aria-hidden="true" />
                This PDF will be immediately removed and no longer downloadable by students.
              </p>
              {formError && (
                <p className="mt-1 text-[13px] text-destructive">
                  {formError}
                </p>
              )}
              <div className="mt-5 flex flex-wrap justify-end gap-2.5">
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  {saving ? "Deleting…" : "Yes, Delete"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeleting(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </AdminShell>
  );
}

