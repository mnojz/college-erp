"use client";

import { useEffect, useMemo, useState } from "react";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="mb-8">
        <Badge variant="secondary" className="mb-3">
          {eyebrow}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </section>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && items.length === 0 && !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <p className="rounded-md border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No published records found in this category yet.
        </p>
      ) : kind === "notices" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {notices.map((notice) => (
            <NoticePostCard
              key={notice.id}
              notice={notice}
              onOpen={() => setSelectedNotice(notice)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <PublicItem key={String(item.id ?? index)} item={item} kind={kind} />
          ))}
        </div>
      )}

      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </div>
  );
}

function PublicItem({ item, kind }: { item: Item; kind: CatalogKind }) {
  if (kind === "fees") {
    // There is no fee model in the schema yet, so this deliberately lists the
    // PROGRAMMES a fee structure will apply to — and says so, rather than
    // presenting a programme card as if it were a fee.
    return (
      <Card>
        <CardContent className="flex h-full flex-col p-5">
          <Badge variant="secondary" className="mb-3 w-fit">
            {String(item.code)}
          </Badge>
          <h2 className="mb-3 text-base font-semibold">{String(item.name)}</h2>
          <p className="text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">Department:</strong>{" "}
            {String(item.departmentName || "General")}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <strong className="font-medium text-foreground">Program Duration:</strong>{" "}
            {String(item.durationYears)} Years ({Number(item.durationYears) * 2} Semesters)
          </p>
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            No fee amounts are published yet, so this page lists the programmes a fee
          structure applies to. Fee data will appear here once the college publishes it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const program = item.program as { name?: string; code?: string } | undefined;
  const semester = typeof item.semester === "number" ? item.semester : undefined;

  return (
    <Card>
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge>{String(item.code)}</Badge>
          {semester && <Badge variant="secondary">Semester {semester}</Badge>}
        </div>
        <h2 className="mb-1 text-base font-semibold">{String(item.name)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {program?.code ? `${program.code} — ${program.name}` : "General Subject Course"}
        </p>
      </CardContent>
    </Card>
  );
}
