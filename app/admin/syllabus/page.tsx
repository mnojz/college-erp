"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SyllabusForm, type SyllabusSubmitValues } from "@/app/components/syllabi/SyllabusForm";
import { SyllabusPreviewModal } from "@/app/components/syllabi/SyllabusPreviewModal";
import { useSyllabusProgramGroups } from "@/app/components/syllabi/SyllabusGroupedList";
import { SyllabusProgramSections } from "@/app/components/syllabi/SyllabusProgramSections";
import { startProgress, doneProgress } from "@/app/components/layout/RouteProgress";
import {
  formatBytes,
  MAX_SYLLABUS_BYTES,
  resolveTitle,
  type ProgramsMeta,
  type SyllabusDto,
} from "@/app/lib/syllabi-shared";
import { IconAlertTriangle, IconFileTypePdf } from "@tabler/icons-react";

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
  const [previewSyllabus, setPreviewSyllabus] = useState<Syllabus | null>(null);
  const [editing, setEditing] = useState<Syllabus | null>(null);
  const [deleting, setDeleting] = useState<Syllabus | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  /** Empty slot currently receiving a direct upload (drives the slot spinner). */
  const [uploadingSlot, setUploadingSlot] = useState<{
    programId: string | null;
    semester: number;
  } | null>(null);

  async function refresh() {
    startProgress();
    try {
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
    } finally {
      doneProgress();
    }
  }

  useEffect(() => {
    async function load() {
      try {
        startProgress();
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
        doneProgress();
      }
    }
    load();
  }, [router]);

  // Include all programs so empty slots are directly visible and clickable
  const groups = useSyllabusProgramGroups(syllabi, meta.programs, true);

  /** Direct-to-slot upload: triggers immediately when user picks or drops a file on any card */
  async function handleDirectUpload(programId: string | null, semester: number, file: File) {
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
      fd.append("departmentName", meta.departments[0] ?? "");
      fd.append("programId", programId ?? "");
      fd.append("semester", String(semester));
      fd.append("file", file);

      const res = await fetch("/api/syllabus", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to upload syllabus");
      await refresh();
      toast.success("Syllabus uploaded successfully.");
    } catch (err) {
      const msg = (err as Error).message ?? "Unable to upload syllabus";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
      setUploadingSlot(null);
    }
  }

  async function handleUpdate(values: SyllabusSubmitValues) {
    if (!editing) return;
    setFormError("");
    setSaving(true);
    try {
      const fd = new FormData();
      if (values.title) fd.append("title", values.title.trim());
      fd.append("departmentName", meta.departments[0] ?? "");
      fd.append("programId", values.programId);
      fd.append("semester", values.semester);
      if (values.file) fd.append("file", values.file);

      const res = await fetch(`/api/syllabus/${editing.id}`, { method: "PATCH", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update syllabus");
      await refresh();
      setEditing(null);
      toast.success("Syllabus updated successfully.");
    } catch (err) {
      const msg = (err as Error).message ?? "Unable to update syllabus";
      setFormError(msg);
      toast.error(msg);
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
      toast.success("Syllabus deleted successfully.");
    } catch (err) {
      const msg = (err as Error).message ?? "Unable to delete syllabus";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminShell
        title="Syllabus Library"
        subtitle="Curriculum outlines & semester schemes"
        active="/admin/syllabus"
      >
        <div className="space-y-6">
          {[1, 2].map((p) => (
            <div key={p} className="rounded-xl border border-border/70 bg-card overflow-hidden">
              <div className="border-b bg-muted/20 px-5 py-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="mt-1 h-3.5 w-32" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <div key={s} className="rounded-xl border border-dashed border-border/70 p-4 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Syllabus Library"
      subtitle="Curriculum outlines & semester schemes"
      active="/admin/syllabus"
    >
      <div className="space-y-5">
        {/* Feedback messages */}
        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs sm:text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {/* Program Sections Matrix */}
        <SyllabusProgramSections
          variant="admin"
          groups={groups}
          onPreview={(s) => setPreviewSyllabus(s)}
          onEdit={(s) => setEditing(s)}
          onDelete={(s) => setDeleting(s)}
          onUpload={handleDirectUpload}
          uploading={uploadingSlot}
        />

        {/* On-Page PDF Preview Modal */}
        <SyllabusPreviewModal
          syllabus={previewSyllabus}
          onClose={() => setPreviewSyllabus(null)}
        />

        {/* Edit Modal */}
        {editing && (
          <AdminModal title="Edit Syllabus Details" wide onClose={() => setEditing(null)}>
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

        {/* Delete Confirmation Modal */}
        {deleting && (
          <AdminModal title="Delete Syllabus" onClose={() => setDeleting(null)}>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <IconFileTypePdf size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm sm:text-base font-semibold text-foreground">
                    {resolveTitle(deleting)}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Semester {deleting.semester} • {formatBytes(deleting.fileSize)}
                  </p>
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                <IconAlertTriangle size={18} className="shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                <span>
                  This PDF will be permanently deleted and will no longer be accessible to students or teachers.
                </span>
              </p>

              {formError && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeleting(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  {saving ? "Deleting…" : "Yes, Delete PDF"}
                </Button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </AdminShell>
  );
}
