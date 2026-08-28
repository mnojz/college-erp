"use client";

import { useEffect, useMemo, useState } from "react";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";

type CatalogKind = "courses" | "syllabus" | "fees" | "notices";
type CatalogProps = { kind: CatalogKind; title: string; eyebrow: string; description: string };

type Item = Record<string, unknown>;

export function PublicCatalog({ kind, title, eyebrow, description }: CatalogProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeDetailData | null>(null);

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

  // Map raw announcement rows into the client-safe notice shape used by the
  // post-style cards and the detail modal.
  const notices = useMemo<NoticeDetailData[]>(
    () =>
      kind === "notices"
        ? items.map((item, index) => ({
            id: String(item.id ?? index),
            title: String(item.title ?? ""),
            body: String(item.body ?? ""),
            publishedAt: item.publishedAt ? String(item.publishedAt) : null,
            createdAt: String(item.createdAt ?? item.publishedAt ?? new Date().toISOString()),
            author: (item.author as NoticeDetailData["author"]) ?? null,
            attachment: item.attachmentFileName
              ? {
                  fileName: String(item.attachmentFileName),
                  mimeType: String(item.attachmentMimeType ?? "application/octet-stream"),
                  size: Number(item.attachmentSize ?? 0),
                }
              : null,
          }))
        : [],
    [items, kind],
  );

  return (
    <div className="public-page-body">
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
      ) : kind === "notices" ? (
        <div className="public-list notice-list">
          {notices.map((notice) => (
            <NoticePostCard
              key={notice.id}
              notice={notice}
              onOpen={() => setSelectedNotice(notice)}
            />
          ))}
        </div>
      ) : (
        <div className="public-list">
          {items.map((item, index) => (
            <PublicItem key={String(item.id ?? index)} item={item} kind={kind} />
          ))}
        </div>
      )}

      {loading && items.length === 0 && !error && <p className="public-empty">Loading…</p>}

      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </div>
  );
}

function PublicItem({ item, kind }: { item: Item; kind: CatalogKind }) {
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
