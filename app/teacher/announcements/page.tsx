"use client";
import { Button } from "@/components/ui/button";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { ListSkeleton } from "@/app/components/layout/PageSkeletons";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { FileDropzone } from "@/app/components/common/FileDropzone";
import { NoticeAttachment } from "@/app/components/common/NoticeDetailModal";
import { AnnouncementsBoard } from "@/app/components/announcements/AnnouncementsBoard";
import {
  IconAlertTriangle,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

type TeacherClass = {
  id: string;
  semester: number;
  subject: { id: string; name: string; code: string };
  program: { id: string; name: string; code: string; students: Array<{ id: string }> };
};

type TeacherInfo = {
  id: string;
  employeeNo: string;
  profileImageUrl: string | null;
  user: { id: string; firstName: string; lastName: string };
  classes: TeacherClass[];
};

/** A teaching group a notice can target (subject × program × semester). */
type ClassGroup = {
  key: string;
  label: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  programId: string;
  programName: string;
  programCode: string;
  semester: number;
  students: number;
};

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  authorId: string;
  teacherId: string | null;
  semester: number | null;
  author: { firstName: string; lastName: string } | null;
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
  scopeKey: string;
  file: File | null;
  removeAttachment: boolean;
  existingAttachment: NoticeAttachment | null;
};

const emptyForm = {
  title: "",
  body: "",
  scopeKey: "",
  file: null as File | null,
};

function attachmentMetaOf(a: AnnouncementItem): NoticeAttachment | null {
  if (!a.attachmentFileName || a.attachmentSize === null) return null;
  return {
    fileName: a.attachmentFileName,
    mimeType: a.attachmentMimeType ?? "application/octet-stream",
    size: a.attachmentSize,
  };
}

export default function TeacherAnnouncementsPage() {
  const router = useRouter();
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<EditingNotice | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementItem | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch("/api/teacher/profile");
        if (profileRes.status === 401 || profileRes.status === 403) {
          router.replace("/dashboard");
          return;
        }
        const [announcementsRes] = await Promise.all([fetch("/api/announcements")]);
        if (!profileRes.ok || !announcementsRes.ok) {
          setLoadError("Unable to load your announcements");
          return;
        }
        const profileData = await profileRes.json();
        const announcementsData = await announcementsRes.json();
        setTeacherInfo(profileData.teacher);
        setAnnouncements(announcementsData.announcements ?? []);
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
      if (groups.has(key)) continue;
      groups.set(key, {
        key,
        label: `${c.subject.name} — ${c.program.code} · Sem ${c.semester}`,
        subjectId: c.subject.id,
        subjectName: c.subject.name,
        subjectCode: c.subject.code,
        programId: c.program.id,
        programName: c.program.name,
        programCode: c.program.code,
        semester: c.semester,
        students: c.program.students.length,
      });
    }
    return [...groups.values()];
  }, [teacherInfo]);

  const scopeKeyFor = (a: AnnouncementItem): string => {
    if (!a.subject || !a.program || a.semester == null) return "";
    return `${a.subject.id}__${a.program.id}__${a.semester}`;
  };

  async function refresh() {
    const res = await fetch("/api/announcements");
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    }
  }

  function scopePayload(scopeKey: string): {
    subjectId: string;
    programId: string;
    semester: number;
  } | null {
    const group = classGroups.find((g) => g.key === scopeKey);
    if (!group) return null;
    return { subjectId: group.subjectId, programId: group.programId, semester: group.semester };
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = scopePayload(form.scopeKey);
    if (!payload) {
      setFormError("Choose the subject and class you want to notify.");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("title", form.title);
      fd.set("body", form.body);
      fd.set("subjectId", payload.subjectId);
      fd.set("programId", payload.programId);
      fd.set("semester", String(payload.semester));
      if (form.file) fd.set("file", form.file);
      const res = await fetch("/api/announcements", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to publish announcement");
        return;
      }
      await refresh();
      setForm(emptyForm);
      setShowCreateModal(false);
      toast.success("Announcement published to your class successfully.");
    } catch {
      setFormError("Failed to submit announcement");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const payload = scopePayload(editing.scopeKey);
    if (!payload) {
      setFormError("Choose the subject and class you want to notify.");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", editing.id);
      fd.set("title", editing.title);
      fd.set("body", editing.body);
      fd.set("subjectId", payload.subjectId);
      fd.set("programId", payload.programId);
      fd.set("semester", String(payload.semester));
      if (editing.file) {
        fd.set("file", editing.file);
      } else if (editing.removeAttachment) {
        fd.set("removeAttachment", "1");
      }
      const res = await fetch("/api/announcements", { method: "PUT", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to update announcement");
        return;
      }
      await refresh();
      setEditing(null);
      toast.success("Announcement updated successfully.");
    } catch {
      setFormError("Failed to update announcement");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/announcements?id=${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to delete announcement");
        toast.error(data.error ?? "Failed to delete announcement");
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleting.id));
      setDeleting(null);
      toast.success("Announcement deleted successfully.");
    } catch {
      setFormError("Failed to delete announcement");
      toast.error("Failed to delete announcement");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <main className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-destructive">{loadError}</main>;
  if (loading || !teacherInfo) {
    return (
      <TeacherShell
        title="Announcements & Class Notices"
        subtitle="Notify your students"
        active="/teacher/announcements"
      >
        <ListSkeleton rows={5} />
      </TeacherShell>
    );
  }

  const userId = teacherInfo.user.id;

  return (
    <TeacherShell
      title="Announcements & Class Notices"
      subtitle="Notify your students"
      active="/teacher/announcements"
      teacherName={`${teacherInfo.user.firstName} ${teacherInfo.user.lastName}`}
      employeeNo={teacherInfo.employeeNo}
      avatarUrl={teacherInfo.profileImageUrl}
      headerActions={
        <Button
          type="button"
          onClick={() => {
            setFormError("");
            setShowCreateModal(true);
          }}
        >
          <IconPlus size={16} aria-hidden="true" /> New Announcement
        </Button>
      }
    >
      {formError && !deleting && !showCreateModal && !editing && (
        <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">{formError}</p>
      )}

      <AnnouncementsBoard
        variant="teacher"
        items={announcements}
        loading={loading}
        currentUserId={userId}
        onRefresh={refresh}
        renderCardActions={(_notice, raw) => {
          const isMine = raw.authorId === userId;
          if (!isMine) return null;
          return (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Edit Announcement"
                aria-label="Edit Announcement"
                onClick={() => {
                  setFormError("");
                  setEditing({
                    id: raw.id,
                    title: raw.title,
                    body: raw.body,
                    scopeKey: scopeKeyFor(raw) || classGroups[0]?.key || "",
                    file: null,
                    removeAttachment: false,
                    existingAttachment: attachmentMetaOf(raw),
                  });
                }}
              >
                <IconPencil size={14} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                title="Delete Announcement"
                aria-label="Delete Announcement"
                onClick={() => {
                  setFormError("");
                  setDeleting(raw);
                }}
              >
                <IconTrash size={14} aria-hidden="true" />
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

              {/* Right Column: Class & Attachment */}
              <div className="flex flex-col gap-3 min-w-0">
                <label className="form-field">
                  Class
                  <select
                    className="form-control"
                    value={form.scopeKey}
                    onChange={(e) => setForm({ ...form, scopeKey: e.target.value })}
                    required
                  >
                    <option value="">Select class</option>
                    {classGroups.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label} ({g.students} students)
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-foreground">Attachment</span>
                  <FileDropzone
                    id="teacher-notice-create-attachment"
                    className="flex-1 min-h-[120px]"
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime,application/pdf"
                    file={form.file}
                    onFileChange={(file) => setForm({ ...form, file })}
                    label="Upload file or drag & drop"
                    dropLabel="Drop file here"
                    hint="Max 25 MB (Images, Videos, PDF)"
                  />
                </div>
              </div>
            </div>

            {formError && <p className="m-0 text-[13px] text-destructive">{formError}</p>}

            {/* Footer Buttons */}
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
      {editing && (
        <AdminModal wide title="Edit Announcement" onClose={() => setEditing(null)}>
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
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    required
                  />
                </label>

                <label className="form-field flex-1 flex flex-col">
                  Content
                  <textarea
                    className="form-control flex-1 resize-none"
                    placeholder="Write announcement..."
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    rows={5}
                    required
                  />
                </label>
              </div>

              {/* Right Column: Class & Attachment */}
              <div className="flex flex-col gap-3 min-w-0">
                <label className="form-field">
                  Class
                  <select
                    className="form-control"
                    value={editing.scopeKey}
                    onChange={(e) => setEditing({ ...editing, scopeKey: e.target.value })}
                    required
                  >
                    <option value="">Select class</option>
                    {classGroups.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label} ({g.students} students)
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-foreground">Attachment</span>
                  {editing.existingAttachment && !editing.file && !editing.removeAttachment && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-border/80 bg-muted/30 text-xs min-w-0">
                      <span className="inline-flex items-center gap-1.5 truncate min-w-0 font-medium">
                        <IconPaperclip size={13} className="shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{editing.existingAttachment.fileName}</span>
                      </span>
                      <button
                        type="button"
                        className="text-destructive hover:underline shrink-0 text-[11px] font-semibold cursor-pointer"
                        onClick={() => setEditing({ ...editing, removeAttachment: true })}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {editing.removeAttachment && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                      <span>Attachment will be removed</span>
                      <button
                        type="button"
                        className="text-foreground hover:underline shrink-0 text-[11px] font-semibold cursor-pointer"
                        onClick={() => setEditing({ ...editing, removeAttachment: false })}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                  <FileDropzone
                    id="teacher-notice-edit-attachment"
                    className="flex-1 min-h-[110px]"
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime,application/pdf"
                    file={editing.file}
                    onFileChange={(file) => setEditing({ ...editing, file, removeAttachment: false })}
                    label="Upload new file or drag & drop"
                    dropLabel="Drop new attachment here"
                    hint="Replaces existing attachment (up to 25 MB)"
                  />
                </div>
              </div>
            </div>

            {formError && <p className="m-0 text-[13px] text-destructive">{formError}</p>}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button variant="outline" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Delete Announcement Confirmation */}
      {deleting && (
        <AdminModal title="Delete Announcement" onClose={() => setDeleting(null)}>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>
              Are you sure you want to delete the notice <strong>&ldquo;{deleting.title}&rdquo;</strong>?
            </p>
            <p className="m-0 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-[13px] font-medium text-amber-600 dark:text-amber-400">
              <IconAlertTriangle size={14} aria-hidden="true" />
              Students of this class will no longer see this announcement.
            </p>
            {formError && (
              <p className="m-0 text-[13px] text-destructive" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2.5" style={{ marginTop: "20px" }}>
              <Button variant="destructive" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Notice"}
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
    </TeacherShell>
  );
}