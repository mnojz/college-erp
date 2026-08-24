"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CatalogKind = "courses" | "syllabus" | "fees" | "notices";
type CatalogProps = { kind: CatalogKind; title: string; eyebrow: string; description: string };

type Item = Record<string, unknown>;

export function PublicCatalog({ kind, title, eyebrow, description }: CatalogProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const endpoint = kind === "courses" || kind === "syllabus" ? "/api/courses" : kind === "fees" ? "/api/fees" : "/api/announcements";
  const key = kind === "courses" || kind === "syllabus" ? "courses" : kind;

  useEffect(() => {
    fetch(endpoint).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load records");
      setItems(result[key] ?? []);
    }).catch((reason: Error) => setError(reason.message));
  }, [endpoint, key]);

  return (
    <main className="public-page">
      <header className="public-page-header"><Link href="/">College-ERP</Link><Link href="/">Back to home</Link></header>
      <section className="public-page-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></section>
      {error && <p className="banner error-banner">{error}</p>}
      {items.length === 0 && !error ? <p className="public-empty">No published information is available yet.</p> : <div className={`public-list ${kind === "notices" ? "notice-list" : ""}`}>{items.map((item, index) => <PublicItem key={String(item.id ?? index)} item={item} kind={kind} />)}</div>}
    </main>
  );
}

function PublicItem({ item, kind }: { item: Item; kind: CatalogKind }) {
  if (kind === "notices") return <article className="public-item"><p className="eyebrow">{item.publishedAt ? new Date(String(item.publishedAt)).toLocaleDateString() : "Notice"}</p><h2>{String(item.title)}</h2><p>{String(item.body)}</p></article>;
  if (kind === "fees") return <article className="public-item"><h2>{String(item.name)}</h2><p>{item.program ? `${(item.program as { code: string }).code} · ${(item.program as { name: string }).name}` : "General fee"}</p><strong>Rs. {String(item.amount)}</strong></article>;
  return <article className="public-item"><p className="eyebrow">{String(item.code)}</p><h2>{String(item.name)}</h2><p>{kind === "syllabus" ? `Official syllabus outline · ${String(item.credits)} credits` : `Department course · ${String(item.credits)} credits`}</p></article>;
}
