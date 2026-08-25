"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { useTheme } from "@/app/lib/useTheme";

type CatalogKind = "courses" | "syllabus" | "fees" | "notices";
type CatalogProps = { kind: CatalogKind; title: string; eyebrow: string; description: string };

type Item = Record<string, unknown>;

export function PublicCatalog({ kind, title, eyebrow, description }: CatalogProps) {
  useTheme(); // ensure theme initialized
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const endpoint =
    kind === "courses" || kind === "syllabus"
      ? "/api/subjects"
      : kind === "fees"
      ? "/api/programs"
      : "/api/announcements";

  const key =
    kind === "courses" || kind === "syllabus"
      ? "subjects"
      : kind === "fees"
      ? "programs"
      : "announcements";

  useEffect(() => {
    fetch(endpoint)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load records");
        setItems(result[key] ?? []);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [endpoint, key]);

  return (
    <main className="public-page">
      <header className="public-page-header">
        <Link href="/" className="public-brand">
          <span className="home-brand-icon" style={{ width: 34, height: 34 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
          </span>
          <div style={{ display: "grid", gap: "1px" }}>
            <strong style={{ fontSize: "16px" }}>College-ERP</strong>
            <small style={{ fontSize: "10px", color: "var(--ink-soft)", textTransform: "uppercase" }}>Far Western University</small>
          </div>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <ThemeToggle />
          <Link href="/" className="btn-ghost" style={{ fontSize: "13px", padding: "8px 14px", textDecoration: "none" }}>
            ← Back to Home
          </Link>
        </div>
      </header>

      <section className="public-page-intro">
        <span className="badge badge-blue" style={{ marginBottom: "12px" }}>
          {eyebrow}
        </span>
        <h1 style={{ margin: "6px 0 12px", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 700 }}>{title}</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: "15px", lineHeight: 1.6, maxWidth: "680px" }}>{description}</p>
      </section>

      {error && <p className="banner error-banner">{error}</p>}

      {items.length === 0 && !loading && !error ? (
        <div className="public-empty">
          <p>No published records found in this category yet.</p>
        </div>
      ) : (
        <div className={`public-list ${kind === "notices" ? "notice-list" : ""}`}>
          {items.map((item, index) => (
            <PublicItem key={String(item.id ?? index)} item={item} kind={kind} />
          ))}
        </div>
      )}
    </main>
  );
}

function PublicItem({ item, kind }: { item: Item; kind: CatalogKind }) {
  if (kind === "notices") {
    const published = item.publishedAt || item.createdAt;
    return (
      <article className="public-item">
        <span className="badge badge-green" style={{ marginBottom: "8px" }}>
          {published ? new Date(String(published)).toLocaleDateString() : "Campus Notice"}
        </span>
        <h2>{String(item.title)}</h2>
        <p>{String(item.body)}</p>
      </article>
    );
  }

  if (kind === "fees") {
    return (
      <article className="public-item">
        <span className="badge badge-amber" style={{ marginBottom: "8px" }}>
          {String(item.code)}
        </span>
        <h2>{String(item.name)}</h2>
        <p style={{ margin: "6px 0" }}>
          <strong>Department:</strong> {String(item.departmentName || "General")}
        </p>
        <p style={{ margin: "6px 0" }}>
          <strong>Program Duration:</strong> {String(item.durationYears)} Years ({Number(item.durationYears) * 2} Semesters)
        </p>
      </article>
    );
  }

  const program = item.program as { name?: string; code?: string } | undefined;
  const semester = typeof item.semester === "number" ? item.semester : undefined;

  return (
    <article className="public-item">
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
        <span className="badge badge-blue">{String(item.code)}</span>
        {semester && <span className="badge badge-slate">Semester {semester}</span>}
      </div>
      <h2>{String(item.name)}</h2>
      <p style={{ color: "var(--ink-soft)", margin: "4px 0" }}>
        {program?.code ? `${program.code} — ${program.name}` : "General Subject Course"}
      </p>
    </article>
  );
}
