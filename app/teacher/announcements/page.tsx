"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { FileDropzone } from "@/app/components/common/FileDropzone";
import {
  NoticeAttachment,
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";
import {
  IconAlertTriangle,
  IconBell,
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
  const [selectedNotice, setSelectedNotice] = useState<NoticeDetailData | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch("/api/teacher/profile");
        if (profileRes.status === 401 || profileRes.status === 403) {
          router.replace("/");
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

  const totalStudentsReached = useMemo(
    () => classGroups.reduce((sum, g) => sum + g.students, 0),
    [classGroups],
  );

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
      setMessage("Announcement published to your class successfully.");
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
      setMessage("Announcement updated successfully.");
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
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleting.id));
      setDeleting(null);
      setMessage("Announcement deleted successfully.");
    } catch {
      setFormError("Failed to delete announcement");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <main className="profile-error">{loadError}</main>;
  if (loading || !teacherInfo) return <main className="profile-loading">Loading announcements…</main>;

  const userId = teacherInfo.user.id;

  return (
    <TeacherShell
      title="Announcements & Class Notices"
      subtitle="Notify your students"
      active="/teacher/announcements"
      teacherName={`${teacherInfo.user.firstName} ${teacherInfo.user.lastName}`}
      employeeNo={teacherInfo.employeeNo}
      avatarUrl={teacherInfo.profileImageUrl}
    >
      <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
        <article className="admin-metric-card">
          <span>Your Notices</span>
          <strong>{announcements.filter((a) => a.authorId === userId).length}</strong>
          <small>Announcements sent to your classes</small>
        </article>
        <article className="admin-metric-card">
          <span>Students Reached</span>
          <strong>{totalStudentsReached}</strong>
          <small>Across {classGroups.length} teaching group{classGroups.length === 1 ? "" : "s"}</small>
        </article>
        <article className="admin-metric-card">
          <span style={{ display: "block", marginBottom: "10px" }}>Notify Students</span>
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              setFormError("");
              setShowCreateModal(true);
            }}
          >
            <IconPlus size={16} aria-hidden="true" /> New Announcement
          </button>
        </article>
      </section>

      {message && <p className="admin-message success">{message}</p>}
      {formError && !deleting && !showCreateModal && !editing && (
        <p className="admin-message error">{formError}</p>
      )}

      <div className="admin-notice-grid">
        {announcements.length === 0 ? (
          <div className="admin-table-wrap">
            <div className="admin-table-empty">
              <IconBell size={26} aria-hidden="true" />
              <p>
                No announcements yet. Click <strong>New Announcement</strong> to notify the students of a
                subject &amp; class you teach.
              </p>
            </div>
          </div>
        ) : (
          announcements.map((a) => {
            const isMine = a.authorId === userId;
            return (
              <NoticePostCard
                key={a.id}
                notice={toNoticeDetail(a)}
                onOpen={() => setSelectedNotice(toNoticeDetail(a))}
                actions={
                  isMine ? (
                    <>
                      <button
                        type="button"
                        className="btn-action-edit"
                        title="Edit Announcement"
                        aria-label="Edit Announcement"
                        onClick={() => {
                          setFormError("");
                          setEditing({
                            id: a.id,
                            title: a.title,
                            body: a.body,
                            scopeKey: scopeKeyFor(a) || classGroups[0]?.key || "",
                            file: null,
                            removeAttachment: false,
                            existingAttachment: attachmentMetaOf(a),
                          });
                        }}
                      >
                        <IconPencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn-action-delete"
                        title="Delete Announcement"
                        aria-label="Delete Announcement"
                        onClick={() => {
                          setFormError("");
                          setDeleting(a);
                        }}
                      >
                        <IconTrash size={15} aria-hidden="true" />
                      </button>
                    </>
                  ) : undefined
                }
              />
            );
          })
        )}
      </div>

      {/* Modal 1: Create Announcement */}
      {showCreateModal && (
        <AdminModal
          title="Publish Class Announcement"
          onClose={() => {
            setShowCreateModal(false);
            setForm(emptyForm);
          }}
        >
          <form className="modal-form" onSubmit={handleCreate}>
            <label>
              Notify Subject &amp; Class
              <select
                value={form.scopeKey}
                onChange={(e) => setForm({ ...form, scopeKey: e.target.value })}
                required
              >
                <option value="">— Choose a class you teach —</option>
                {classGroups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label} ({g.students} student{g.students === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Only students of this subject &amp; class will see the notice.
              </small>
            </label>

            <label>
              Announcement Headline
              <input
                type="text"
                placeholder="e.g. Assignment submission deadline extended"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <label>
              Full Announcement Content
              <textarea
                placeholder="Write the full message for your students..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={6}
                required
              />
            </label>

            <label>
              Attachment <span className="optional-tag">(optional image or PDF)</span>
              <FileDropzone
                id="teacher-notice-create-attachment"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                file={form.file}
                onFileChange={(file) => setForm({ ...form, file })}
                label="Drag & drop an image or PDF here"
                dropLabel="Drop the attachment here"
                hint="or click to browse — PNG, JPEG, WEBP, GIF or PDF, up to 10 MB"
              />
            </label>

            {formError && <p className="admin-form-error">{formError}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Publishing…" : "Publish to Class"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 2: Edit Announcement */}
      {editing && (
        <AdminModal title="Edit Announcement / Notice" onClose={() => setEditing(null)}>
          <form className="modal-form" onSubmit={handleUpdate}>
            <label>
              Notify Subject &amp; Class
              <select
                value={editing.scopeKey}
                onChange={(e) => setEditing({ ...editing, scopeKey: e.target.value })}
                required
              >
                {classGroups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label} ({g.students} student{g.students === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Announcement Headline
              <input
                type="text"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
              />
            </label>

            <label>
              Full Announcement Content
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={6}
                required
              />
            </label>

            <label>
              Attachment <span className="optional-tag">(optional image or PDF)</span>
              {editing.existingAttachment && !editing.file && (
                <span className="notice-card-attachment-chip">
                  <IconPaperclip size={13} aria-hidden="true" />
                  Current: {editing.existingAttachment.fileName}
                </span>
              )}
              <FileDropzone
                id="teacher-notice-edit-attachment"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                file={editing.file}
                onFileChange={(file) => setEditing({ ...editing, file, removeAttachment: false })}
                label="Drag & drop a new image or PDF here"
                dropLabel="Drop the attachment here"
                hint="or click to browse — a new file replaces the current attachment"
              />
              {editing.existingAttachment && (
                <span className="notice-attachment-remove">
                  <input
                    type="checkbox"
                    id="teacher-notice-remove-attachment"
                    checked={editing.removeAttachment}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        removeAttachment: e.target.checked,
                        file: null,
                      })
                    }
                  />
                  <label htmlFor="teacher-notice-remove-attachment">Remove attachment</label>
                </span>
              )}
            </label>

            {formError && <p className="admin-form-error">{formError}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Modal 3: Delete Announcement Confirmation */}
      {deleting && (
        <AdminModal title="Delete Announcement" onClose={() => setDeleting(null)}>
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete the notice <strong>&ldquo;{deleting.title}&rdquo;</strong>?
            </p>
            <p className="admin-form-error notice-confirm-warning">
              <IconAlertTriangle size={14} aria-hidden="true" />
              Students of this class will no longer see this announcement.
            </p>
            {formError && (
              <p className="admin-form-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-danger" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Notice"}
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

      {/* Modal 4: Notice details with attachment preview */}
      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </TeacherShell>
  );
}