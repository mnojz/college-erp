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
  const [showModal, setShowModal] = useState(false);
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
      setShowModal(false);
      setMessage("Announcement published successfully.");
    } catch {
      setError("Failed to submit announcement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Announcements & Notices" subtitle="Campus Communications" active="/admin/announcements">
      {/* Top action bar */}
      <div className="admin-topbar">
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, fontFamily: "Arial, sans-serif" }}>
          {loading ? "Loading notices…" : `${announcements.length} notice${announcements.length !== 1 ? "s" : ""} broadcasted`}
        </p>
        <div className="admin-topbar-actions">
          <button
            className="btn-add"
            type="button"
            onClick={() => {
              setShowModal(true);
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span className="badge badge-green">PUBLISHED</span>
                    <span style={{ fontSize: "12px", color: "#64748b", fontFamily: "Arial, sans-serif" }}>
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
                {a.author && (
                  <span style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                    By {a.author.firstName} {a.author.lastName}
                  </span>
                )}
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

      {/* Add Announcement Modal */}
      {showModal && (
        <AdminModal
          title="Publish New Notice / Announcement"
          onClose={() => {
            setShowModal(false);
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
                  setShowModal(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </AdminShell>
  );
}
