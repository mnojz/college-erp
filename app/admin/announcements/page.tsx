"use client";
import { Button } from "@/components/ui/button";
import { startProgress, doneProgress } from "@/app/components/layout/RouteProgress";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { FileDropzone } from "@/app/components/common/FileDropzone";
import { AnnouncementsBoard } from "@/app/components/announcements/AnnouncementsBoard";
import {
  IconAlertTriangle,
  IconArchive,
  IconArchiveOff,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

type NoticeAttachmentMeta = {
  fileName: string;
  mimeType: string;
  size: number;
};

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  author: { firstName: string; lastName: string } | null;
  teacherId: string | null;
  semester: number | null;
  subject: { id: string; name: string; code: string } | null;
  program: { id: string; name: string; code: string } | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
};

type EditingNotice = {
  id: string;
  title: string;
  body: string;
  file: File | null;
  removeAttachment: boolean;
  existingAttachment: NoticeAttachmentMeta | null;
};

const emptyForm = {
  title: "",
  body: "",
  file: null as File | null,
};

function attachmentMetaOf(a: AnnouncementItem): NoticeAttachmentMeta | null {
  if (!a.attachmentFileName || a.attachmentSize === null) return null;
  return {
    fileName: a.attachmentFileName,
    mimeType: a.attachmentMimeType ?? "application/octet-stream",
    size: a.attachmentSize,
  };
}

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<EditingNotice | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<AnnouncementItem | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        startProgress();
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        const res = await fetch("/api/announcements");
        const data = await res.json();
        setAnnouncements(data.announcements ?? []);
      } catch {
        setError("Unable to load announcements");
      } finally {
        setLoading(false);
        doneProgress();
      }
    }
    load();
  }, [router]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("title", form.title);
      fd.set("body", form.body);
      fd.set("publishedAt", new Date().toISOString());
      if (form.file) fd.set("file", form.file);
      const res = await fetch("/api/announcements", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to publish announcement");
        return;
      }
      const refresh = await fetch("/api/announcements");
      const refreshData = await refresh.json();
      setAnnouncements(refreshData.announcements ?? []);
      setForm(emptyForm);
      setShowCreateModal(false);
      toast.success("Announcement published successfully.");
    } catch {
      setError("Failed to submit announcement");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingAnnouncement) return;
    setError("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", editingAnnouncement.id);
      fd.set("title", editingAnnouncement.title);
      fd.set("body", editingAnnouncement.body);
      if (editingAnnouncement.file) {
        fd.set("file", editingAnnouncement.file);
      } else if (editingAnnouncement.removeAttachment) {
        fd.set("removeAttachment", "1");
      }
      const res = await fetch("/api/announcements", { method: "PUT", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update announcement");
        return;
      }
      const refresh = await fetch("/api/announcements");
      const refreshData = await refresh.json();
      setAnnouncements(refreshData.announcements ?? []);
      setEditingAnnouncement(null);
      toast.success("Announcement updated successfully.");
    } catch {
      setError("Failed to update announcement");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(target: AnnouncementItem) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, restore: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to restore announcement");
        toast.error(data.error ?? "Failed to restore announcement");
        return;
      }
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === target.id ? { ...a, archivedAt: null, archivedBy: null } : a))
      );
      toast.success("Announcement restored to active bulletins.");
    } catch {
      setError("Failed to restore announcement");
      toast.error("Failed to restore announcement");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingAnnouncement) return;
    setError("");
    setSaving(true);
    const isAlreadyArchived = Boolean(deletingAnnouncement.archivedAt);
    try {
      const endpoint = isAlreadyArchived
        ? `/api/announcements?id=${deletingAnnouncement.id}&permanent=1`
        : `/api/announcements?id=${deletingAnnouncement.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete announcement");
        toast.error(data.error ?? "Failed to delete announcement");
        return;
      }
      if (isAlreadyArchived) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== deletingAnnouncement.id));
        toast.success("Announcement permanently deleted.");
      } else {
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === deletingAnnouncement.id
              ? { ...a, archivedAt: new Date().toISOString() }
              : a
          )
        );
        toast.success("Announcement moved to archive.");
      }
      setDeletingAnnouncement(null);
    } catch {
      setError("Failed to process request");
      toast.error("Failed to process request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Announcements & Notices" subtitle="Campus Communications & Bulletins" active="/admin/announcements">
      {error && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">{error}</p>}

      <AnnouncementsBoard
        variant="admin"
        items={announcements}
        loading={loading}
        onRefresh={async () => {
          const refresh = await fetch("/api/announcements");
          const refreshData = await refresh.json();
          setAnnouncements(refreshData.announcements ?? []);
        }}
        primaryAction={
          <Button
            size="sm"
            type="button"
            onClick={() => {
              setShowCreateModal(true);
              setError("");
            }}
          >
            <IconPlus size={16} aria-hidden="true" />
            New Announcement
          </Button>
        }
        renderCardActions={(_notice, a) => {
          const attachmentMeta = attachmentMetaOf(a);
          const isArchived = Boolean(a.archivedAt);

          if (isArchived) {
            return (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400"
                  title="Restore Announcement"
                  aria-label="Restore Announcement"
                  onClick={() => handleRestore(a)}
                  disabled={saving}
                >
                  <IconArchiveOff size={14} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                  title="Permanently Delete Announcement"
                  aria-label="Permanently Delete Announcement"
                  onClick={() => {
                    setError("");
                    setDeletingAnnouncement(a);
                  }}
                  disabled={saving}
                >
                  <IconTrash size={14} aria-hidden="true" />
                </Button>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Edit Announcement"
                aria-label="Edit Announcement"
                onClick={() => {
                  setError("");
                  setEditingAnnouncement({
                    id: a.id,
                    title: a.title,
                    body: a.body,
                    file: null,
                    removeAttachment: false,
                    existingAttachment: attachmentMeta,
                  });
                }}
              >
                <IconPencil size={14} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 hover:text-amber-800 dark:text-amber-400"
                title="Archive Announcement"
                aria-label="Archive Announcement"
                onClick={() => {
                  setError("");
                  setDeletingAnnouncement(a);
                }}
              >
                <IconArchive size={14} aria-hidden="true" />
              </Button>
            </div>
          );
        }}
      />

      {/* Modal 1: Create Announcement */}
      {showCreateModal && (
        <AdminModal
          wide
          title="New Announcement"
          onClose={() => {
            setShowCreateModal(false);
            setForm(emptyForm);
          }}
        >
          <form className="flex flex-col gap-4" onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {/* Left Column: Title & Content */}
              <div className="flex flex-col gap-3 min-w-0">
                <label className="form-field">
                  Title
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </label>

                <label className="form-field flex-1 flex flex-col">
                  Content
                  <textarea
                    className="form-control flex-1 resize-none"
                    placeholder="Write announcement..."
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    rows={5}
                    required
                  />
                </label>
              </div>

              {/* Right Column: Attachment */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Attachment</span>
                <FileDropzone
                  id="notice-create-attachment"
                  className="flex-1 min-h-[140px]"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime,application/pdf"
                  file={form.file}
                  onFileChange={(file) => setForm({ ...form, file })}
                  label="Upload file or drag & drop"
                  dropLabel="Drop attachment here"
                  hint="Max 25 MB (Images, Videos, PDF)"
                />
              </div>
            </div>

            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Edit Announcement */}
      {editingAnnouncement && (
        <AdminModal
          wide
          title="Edit Announcement"
          onClose={() => setEditingAnnouncement(null)}
        >
          <form className="flex flex-col gap-4" onSubmit={handleUpdate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {/* Left Column: Title & Content */}
              <div className="flex flex-col gap-3 min-w-0">
                <label className="form-field">
                  Title
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Title"
                    value={editingAnnouncement.title}
                    onChange={(e) =>
                      setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="form-field flex-1 flex flex-col">
                  Content
                  <textarea
                    className="form-control flex-1 resize-none"
                    placeholder="Write announcement..."
                    value={editingAnnouncement.body}
                    onChange={(e) =>
                      setEditingAnnouncement({ ...editingAnnouncement, body: e.target.value })
                    }
                    rows={5}
                    required
                  />
                </label>
              </div>

              {/* Right Column: Attachment */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Attachment</span>
                {editingAnnouncement.existingAttachment &&
                  !editingAnnouncement.file &&
                  !editingAnnouncement.removeAttachment && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-border/80 bg-muted/30 text-xs min-w-0">
                      <span className="inline-flex items-center gap-1.5 truncate min-w-0 font-medium">
                        <IconPaperclip size={13} className="shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{editingAnnouncement.existingAttachment.fileName}</span>
                      </span>
                      <button
                        type="button"
                        className="text-destructive hover:underline shrink-0 text-[11px] font-semibold cursor-pointer"
                        onClick={() =>
                          setEditingAnnouncement({ ...editingAnnouncement, removeAttachment: true })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  )}
                {editingAnnouncement.removeAttachment && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                    <span>Attachment will be removed</span>
                    <button
                      type="button"
                      className="text-foreground hover:underline shrink-0 text-[11px] font-semibold cursor-pointer"
                      onClick={() =>
                        setEditingAnnouncement({ ...editingAnnouncement, removeAttachment: false })
                      }
                    >
                      Undo
                    </button>
                  </div>
                )}
                <FileDropzone
                  id="notice-edit-attachment"
                  className="flex-1 min-h-[120px]"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime,application/pdf"
                  file={editingAnnouncement.file}
                  onFileChange={(file) =>
                    setEditingAnnouncement({
                      ...editingAnnouncement,
                      file,
                      removeAttachment: false,
                    })
                  }
                  label="Upload new file or drag & drop"
                  dropLabel="Drop attachment here"
                  hint="Replaces existing attachment (up to 25 MB)"
                />
              </div>
            </div>

            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingAnnouncement(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Delete / Archive Announcement Confirmation */}
      {deletingAnnouncement && (
        <AdminModal
          title={deletingAnnouncement.archivedAt ? "Permanently Delete Announcement" : "Archive Announcement"}
          onClose={() => setDeletingAnnouncement(null)}
        >
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>
              Are you sure you want to {deletingAnnouncement.archivedAt ? "permanently delete" : "archive"} the notice <strong>&ldquo;{deletingAnnouncement.title}&rdquo;</strong>?
            </p>
            {deletingAnnouncement.archivedAt ? (
              <p className="m-0 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive">
                <IconAlertTriangle size={14} aria-hidden="true" className="shrink-0" />
                This will permanently delete the notice and any attachment from the database. This action cannot be undone.
              </p>
            ) : (
              <p className="m-0 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[13px] font-medium text-amber-700 dark:text-amber-400">
                <IconAlertTriangle size={14} aria-hidden="true" className="shrink-0" />
                This notice will be moved to the archive and hidden from all public portals and dashboards. You can restore or permanently delete it later from the Archived filter.
              </p>
            )}
            {error && <p className="m-0 text-[13px] text-destructive" style={{ marginTop: 12 }}>{error}</p>}
            <div className="flex flex-wrap justify-end gap-2.5" style={{ marginTop: "20px" }}>
              <Button
                variant={deletingAnnouncement.archivedAt ? "destructive" : "default"}
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className={!deletingAnnouncement.archivedAt ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
              >
                {saving
                  ? "Processing…"
                  : deletingAnnouncement.archivedAt
                    ? "Yes, Permanently Delete"
                    : "Yes, Archive Announcement"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setDeletingAnnouncement(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
    </AdminShell>
  );
}
