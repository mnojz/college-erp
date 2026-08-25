"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { AdminModal } from "@/app/components/admin/AdminModal";

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  author: { firstName: string; lastName: string } | null;
};

const emptyForm = {
  title: "",
  body: "",
};

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<{ id: string; title: string; body: string } | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<AnnouncementItem | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/");
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
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          publishedAt: new Date().toISOString(),
        }),
      });
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
      const res = await fetch("/api/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAnnouncement.id,
          title: editingAnnouncement.title,
          body: editingAnnouncement.body,
        }),
      });
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
      <div className="admin-topbar">
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
          {loading ? "Loading notices…" : `${announcements.length} notice${announcements.length !== 1 ? "s" : ""} broadcasted`}
        </p>
        <div className="admin-topbar-actions">
          <button
            className="btn-add"
            type="button"
            onClick={() => {
              setShowCreateModal(true);
              setError("");
            }}
          >
            + New Announcement
          </button>
        </div>
      </div>

      {/* Announcements List */}
      <div style={{ display: "grid", gap: "16px" }}>
        {announcements.length === 0 && !loading ? (
          <div className="admin-table-wrap">
            <div className="admin-table-empty">
              No campus announcements yet. Click <strong>+ New Announcement</strong> to publish notices.
            </div>
          </div>
        ) : (
          announcements.map((a) => (
            <article
              key={a.id}
              className="profile-info-card"
              style={{
                padding: "24px",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span className="badge badge-green">PUBLISHED</span>
                    <span style={{ fontSize: "12px", color: "var(--ink-soft)", fontFamily: "Arial, sans-serif" }}>
                      {a.publishedAt
                        ? new Date(a.publishedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: "17px", color: "var(--foreground, #1e293b)", fontWeight: 600 }}>
                    {a.title}
                  </h3>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {a.author && (
                    <span style={{ fontSize: "12px", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                      By {a.author.firstName} {a.author.lastName}
                    </span>
                  )}
                  <div className="table-actions" style={{ marginLeft: "8px" }}>
                    <button
                      type="button"
                      className="btn-action-edit"
                      title="Edit Announcement"
                      aria-label="Edit Announcement"
                      onClick={() => {
                        setError("");
                        setEditingAnnouncement({ id: a.id, title: a.title, body: a.body });
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-action-delete"
                      title="Delete Announcement"
                      aria-label="Delete Announcement"
                      onClick={() => {
                        setError("");
                        setDeletingAnnouncement(a);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--ink-soft, #475569)",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                {a.body}
              </p>
            </article>
          ))
        )}
      </div>

      {error && <p className="admin-message error">{error}</p>}
      {message && <p className="admin-message success">{message}</p>}

      {/* Modal 1: Create Announcement */}
      {showCreateModal && (
        <AdminModal
          title="Publish New Notice / Announcement"
          onClose={() => {
            setShowCreateModal(false);
            setForm(emptyForm);
          }}
        >
          <form className="modal-form" onSubmit={handleCreate}>
            <label>
              Announcement Headline
              <input
                type="text"
                placeholder="e.g. Mid-Term Examination Schedule Released"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>

            <label>
              Full Announcement Content
              <textarea
                placeholder="Write the full message for faculty and students..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={6}
                required
              />
            </label>

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Publishing…" : "Publish Announcement"}
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
      {editingAnnouncement && (
        <AdminModal
          title="Edit Announcement / Notice"
          onClose={() => setEditingAnnouncement(null)}
        >
          <form className="modal-form" onSubmit={handleUpdate}>
            <label>
              Announcement Headline
              <input
                type="text"
                value={editingAnnouncement.title}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                required
              />
            </label>

            <label>
              Full Announcement Content
              <textarea
                value={editingAnnouncement.body}
                onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, body: e.target.value })}
                rows={6}
                required
              />
            </label>

            {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving Changes…" : "Save Changes"}
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setEditingAnnouncement(null)}
              >
                Cancel
              </button>
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
          <div className="modal-confirm-box">
            <p>
              Are you sure you want to delete the notice <strong>&ldquo;{deletingAnnouncement.title}&rdquo;</strong>?
            </p>
            <p style={{ fontSize: "13px", color: "#dc2626", background: "rgba(220, 38, 38, 0.08)", padding: "10px 14px", borderRadius: "8px" }}>
              ⚠️ This bulletin will be removed from the public portal and all dashboards.
            </p>
            {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#b91c1c" }}>{error}</p>}
            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button className="btn-danger" type="button" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete Notice"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setDeletingAnnouncement(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </AdminShell>
  );
}
