"use client";
import { Button } from "@/components/ui/button";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { FileDropzone } from "@/app/components/common/FileDropzone";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";
import {
  IconAlertTriangle,
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

function toNoticeDetail(a: AnnouncementItem): NoticeDetailData {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
    author: a.author,
    scope:
      a.teacherId && a.subject && a.program && a.semester != null
        ? {
            subjectName: a.subject.name,
            subjectCode: a.subject.code,
            programName: a.program.name,
            programCode: a.program.code,
            semester: a.semester,
          }
        : null,
    attachment: attachmentMetaOf(a),
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
  const [selectedNotice, setSelectedNotice] = useState<NoticeDetailData | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
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
      setMessage("Announcement published successfully.");
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
      setMessage("Announcement updated successfully.");
    } catch {
      setError("Failed to update announcement");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingAnnouncement) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/announcements?id=${deletingAnnouncement.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete announcement");
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== deletingAnnouncement.id));
      setMessage("Announcement deleted successfully.");
      setDeletingAnnouncement(null);
    } catch {
      setError("Failed to delete announcement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Announcements & Notices" subtitle="Campus Communications" active="/admin/announcements">
      {/* Top action bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
          {loading ? "Loading notices…" : `${announcements.length} notice${announcements.length !== 1 ? "s" : ""} broadcasted`}
        </p>
        <div className="flex flex-wrap gap-2.5">
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
        </div>
      </div>

      {/* Announcements List */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:h-full">
        {announcements.length === 0 && !loading ? (
          <div className="w-full overflow-x-auto rounded-lg border">
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              No campus announcements yet. Click <strong>+ New Announcement</strong> to publish notices.
            </div>
          </div>
        ) : (
          announcements.map((a) => {
            const attachmentMeta = attachmentMetaOf(a);
            return (
              <NoticePostCard
                key={a.id}
                notice={toNoticeDetail(a)}
                onOpen={() => setSelectedNotice(toNoticeDetail(a))}
                actions={
                  <>
                    <Button
                      type="button"
                      variant="outline" size="icon-sm"
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
                      <IconPencil size={15} aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline" size="icon-sm" className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                      title="Delete Announcement"
                      aria-label="Delete Announcement"
                      onClick={() => {
                        setError("");
                        setDeletingAnnouncement(a);
                      }}
                    >
                      <IconTrash size={15} aria-hidden="true" />
                    </Button>
                  </>
                }
              />
            );
          })
        )}
      </div>

      {error && <p className="mt-3.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">{error}</p>}
      {message && <p className="mt-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400">{message}</p>}

      {/* Modal 1: Create Announcement */}
      {showCreateModal && (
        <AdminModal
          title="Publish New Notice / Announcement"
          onClose={() => {
            setShowCreateModal(false);
            setForm(emptyForm);
          }}
        >
          <form className="grid gap-4" onSubmit={handleCreate}>
            <label className="form-field">
              Announcement Headline
              <input
 className="form-control"
                type="text"
                placeholder="e.g. Mid-Term Examination Schedule Released"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <label className="form-field">
              Full Announcement Content
              <textarea
 className="form-control"
                placeholder="Write the full message for faculty and students..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={6}
                required
              />
            </label>

            <label className="form-field">
              Attachment <span className="text-xs font-normal text-muted-foreground">(optional image or PDF)</span>
              <FileDropzone
                id="notice-create-attachment"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                file={form.file}
                onFileChange={(file) => setForm({ ...form, file })}
                label="Drag & drop an image or PDF here"
                dropLabel="Drop the attachment here"
                hint="or click to browse — PNG, JPEG, WEBP, GIF or PDF, up to 10 MB"
              />
            </label>

            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="submit" disabled={saving}>
                {saving ? "Publishing…" : "Publish Announcement"}
              </Button>
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
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Edit Announcement */}
      {editingAnnouncement && (
        <AdminModal
          title="Edit Announcement / Notice"
          onClose={() => setEditingAnnouncement(null)}
        >
          <form className="grid gap-4" onSubmit={handleUpdate}>
            <label className="form-field">
              Announcement Headline
              <input
 className="form-control"
                type="text"
                value={editingAnnouncement.title}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                required
              />
            </label>

            <label className="form-field">
              Full Announcement Content
              <textarea
 className="form-control"
                value={editingAnnouncement.body}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, body: e.target.value })}
                rows={6}
                required
              />
            </label>

            <label className="form-field">
              Attachment <span className="text-xs font-normal text-muted-foreground">(optional image or PDF)</span>
              {editingAnnouncement.existingAttachment && !editingAnnouncement.file && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <IconPaperclip size={13} aria-hidden="true" />
                  Current: {editingAnnouncement.existingAttachment.fileName}
                </span>
              )}
              <FileDropzone
                id="notice-edit-attachment"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                file={editingAnnouncement.file}
                onFileChange={(file) =>
                  setEditingAnnouncement({ ...editingAnnouncement, file, removeAttachment: false })
                }
                label="Drag & drop a new image or PDF here"
                dropLabel="Drop the attachment here"
                hint="or click to browse — a new file replaces the current attachment"
              />
              {editingAnnouncement.existingAttachment && (
                <span className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    id="notice-remove-attachment"
 className="accent-primary"
                    checked={editingAnnouncement.removeAttachment}
                    onChange={(e) =>
                      setEditingAnnouncement({
                        ...editingAnnouncement,
                        removeAttachment: e.target.checked,
                        file: null,
                      })
                    }
                  />
                  <label htmlFor="notice-remove-attachment">Remove attachment</label>
                </span>
              )}
            </label>

            {error && <p className="m-0 text-[13px] text-destructive">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingAnnouncement(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Delete Announcement Confirmation */}
      {deletingAnnouncement && (
        <AdminModal
          title="Delete Announcement"
          onClose={() => setDeletingAnnouncement(null)}
        >
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>
              Are you sure you want to delete the notice <strong>&ldquo;{deletingAnnouncement.title}&rdquo;</strong>?
            </p>
            <p className="m-0 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[13px] font-medium text-amber-600 dark:text-amber-400">
              <IconAlertTriangle size={14} aria-hidden="true" />
              This bulletin will be removed from the public portal and all dashboards.
            </p>
            {error && <p className="m-0 text-[13px] text-destructive" style={{ marginTop: 12 }}>{error}</p>}
            <div className="flex flex-wrap justify-end gap-2.5" style={{ marginTop: "20px" }}>
              <Button variant="destructive" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Notice"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setDeletingAnnouncement(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
      {/* Modal 4: Notice details with attachment preview */}
      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </AdminShell>
  );
}
