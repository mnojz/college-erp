"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) return router.replace("/login");
      const result = await response.json();
      if (result.user.role !== "ADMIN") router.replace("/");
    }).catch(() => setError("Unable to verify your session"));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, isPublic }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Unable to create announcement");
      return;
    }
    setTitle("");
    setBody("");
    setMessage("Announcement published successfully");
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><div><p className="eyebrow">Administration</p><h1>Announcements</h1></div><button className="quiet-button" type="button" onClick={() => router.push("/admin")}>Back to overview</button></header>
      {error && <p className="banner error-banner" role="alert">{error}</p>}
      {message && <p className="banner success-banner" role="status">{message}</p>}
      <section className="announcement-form-panel">
        <p className="eyebrow">New notice</p>
        <h2>Publish an announcement</h2>
        <form className="announcement-form" onSubmit={submit}>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label>Message<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={7} required /></label>
          <label className="checkbox-label"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /> Visible to guests and students</label>
          <button className="primary-button" type="submit">Publish announcement</button>
        </form>
      </section>
    </main>
  );
}
