"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  NoticeAttachment,
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconBell,
  IconFilter,
  IconGridDots,
  IconLayoutList,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  authorId?: string;
  teacherId?: string | null;
  semester?: number | null;
  author?: { firstName: string; lastName: string } | null;
  subject?: { id: string; name: string; code: string } | null;
  program?: { id: string; name: string; code: string } | null;
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
};

export function toNoticeDetailData(a: AnnouncementItem): NoticeDetailData {
  const attachment: NoticeAttachment | null =
    a.attachmentFileName && a.attachmentSize != null
      ? {
          fileName: a.attachmentFileName,
          mimeType: a.attachmentMimeType ?? "application/octet-stream",
          size: a.attachmentSize,
        }
      : null;

  return {
    id: a.id,
    title: a.title,
    body: a.body,
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
    authorId: a.authorId,
    teacherId: a.teacherId,
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
    attachment,
  };
}

export type AnnouncementsBoardProps<T extends AnnouncementItem = AnnouncementItem> = {
  /** Visual variant tailored to role */
  variant?: "student" | "teacher" | "admin" | "public";
  /** Whether to render a page title & description banner */
  showHeader?: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Preloaded items from parent (e.g. teacher/admin workspaces). If omitted, component fetches /api/announcements */
  items?: T[];
  loading?: boolean;
  error?: string;
  onRefresh?: () => Promise<void> | void;
  /** Top toolbar primary action button (e.g. "+ New Announcement") */
  primaryAction?: React.ReactNode;
  /** Per-card action buttons (e.g. edit/delete icons for teacher/admin) */
  renderCardActions?: (notice: NoticeDetailData, raw: T) => React.ReactNode;
  /** Current logged-in user id (for 'My Notices' filter) */
  currentUserId?: string;
  emptyStateMessage?: string;
};

type FilterCategory = "all" | "campus" | "class" | "files" | "mine";
type SortOption = "newest" | "oldest" | "alpha";
type ViewMode = "grid" | "list";

export function AnnouncementsBoard<T extends AnnouncementItem = AnnouncementItem>({
  variant = "public",
  showHeader = false,
  eyebrow,
  title = "Notices",
  subtitle,
  items: externalItems,
  loading: externalLoading,
  error: externalError,
  onRefresh,
  primaryAction,
  renderCardActions,
  currentUserId,
  emptyStateMessage,
}: AnnouncementsBoardProps<T>) {
  const [internalItems, setInternalItems] = useState<T[]>([]);
  const [internalLoading, setInternalLoading] = useState(externalItems === undefined);
  const [internalError, setInternalError] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<NoticeDetailData | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Self-fetch if externalItems are not supplied
  useEffect(() => {
    if (externalItems !== undefined) return;
    let mounted = true;
    async function load() {
      setInternalLoading(true);
      try {
        const res = await fetch("/api/announcements");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load announcements");
        if (mounted) {
          setInternalItems((data.announcements ?? []) as T[]);
          setInternalError("");
        }
      } catch (err: unknown) {
        if (mounted) {
          setInternalError(err instanceof Error ? err.message : "Unable to reach server");
        }
      } finally {
        if (mounted) setInternalLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [externalItems]);

  const rawList: T[] = externalItems !== undefined ? externalItems : internalItems;
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const error = externalError !== undefined ? externalError : internalError;

  // Compute metrics
  const stats = useMemo(() => {
    let campusCount = 0;
    let classCount = 0;
    let filesCount = 0;
    let myCount = 0;

    for (const item of rawList) {
      const isClass = Boolean(item.subject || item.teacherId);
      if (isClass) classCount++;
      else campusCount++;

      if (item.attachmentFileName) filesCount++;
      if (currentUserId && item.authorId === currentUserId) myCount++;
    }

    return {
      total: rawList.length,
      campus: campusCount,
      class: classCount,
      files: filesCount,
      mine: myCount,
    };
  }, [rawList, currentUserId]);

  // Filter & sort announcements
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return rawList
      .filter((item) => {
        // Category filter
        const isClass = Boolean(item.subject || item.teacherId);
        if (activeCategory === "campus" && isClass) return false;
        if (activeCategory === "class" && !isClass) return false;
        if (activeCategory === "files" && !item.attachmentFileName) return false;
        if (activeCategory === "mine" && currentUserId && item.authorId !== currentUserId) {
          return false;
        }

        // Search query filter
        if (q) {
          const authorFull = item.author
            ? `${item.author.firstName} ${item.author.lastName}`.toLowerCase()
            : "";
          const subjectName = item.subject?.name?.toLowerCase() ?? "";
          const subjectCode = item.subject?.code?.toLowerCase() ?? "";
          const programCode = item.program?.code?.toLowerCase() ?? "";
          const title = item.title.toLowerCase();
          const body = item.body.toLowerCase();

          const matches =
            title.includes(q) ||
            body.includes(q) ||
            authorFull.includes(q) ||
            subjectName.includes(q) ||
            subjectCode.includes(q) ||
            programCode.includes(q);

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "alpha") {
          return a.title.localeCompare(b.title);
        }
        const timeA = new Date(a.publishedAt ?? a.createdAt).getTime();
        const timeB = new Date(b.publishedAt ?? b.createdAt).getTime();
        if (sortBy === "oldest") return timeA - timeB;
        return timeB - timeA; // newest default
      });
  }, [rawList, activeCategory, searchQuery, sortBy, currentUserId]);

  const hasActiveFilters = searchQuery !== "" || activeCategory !== "all" || sortBy !== "newest";

  function handleResetFilters() {
    setSearchQuery("");
    setActiveCategory("all");
    setSortBy("newest");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Optional Page Header */}
      {showHeader && (
        <section className="flex flex-col gap-2 border-b border-border/70 pb-6">
          {eyebrow && (
            <Badge variant="secondary" className="w-fit text-xs font-semibold">
              {eyebrow}
            </Badge>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            {primaryAction && <div className="flex shrink-0 items-center gap-2">{primaryAction}</div>}
          </div>
        </section>
      )}

      {/* Control Strip — Search, Category Filters, Sort, View Toggle */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1">
            <IconSearch
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Search by title, subject, content, or author…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm rounded-lg"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search input"
              >
                <IconX size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Right Controls: Sort & Layout Mode */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-2xs hover:bg-accent/5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              aria-label="Sort notices"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="alpha">Sort: Alphabetical (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Grid view"
                aria-label="Grid view"
              >
                <IconGridDots size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="List view"
                aria-label="List view"
              >
                <IconLayoutList size={15} aria-hidden="true" />
              </button>
            </div>

            {onRefresh && (
              <Button
                variant="outline"
                size="icon-sm"
                type="button"
                onClick={() => onRefresh()}
                title="Refresh announcements"
                aria-label="Refresh announcements"
              >
                <IconRefresh size={15} aria-hidden="true" />
              </Button>
            )}

            {primaryAction && !showHeader && (
              <div className="ml-auto">{primaryAction}</div>
            )}
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5 text-xs">
          <span className="mr-1 flex items-center gap-1 text-muted-foreground font-medium">
            <IconFilter size={13} aria-hidden="true" />
            <span>Filter:</span>
          </span>

          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              activeCategory === "all"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All Bulletins ({stats.total})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("campus")}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              activeCategory === "campus"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Official Campus ({stats.campus})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("class")}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              activeCategory === "class"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Class &amp; Academic ({stats.class})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("files")}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              activeCategory === "files"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            With Files ({stats.files})
          </button>

          {currentUserId && (
            <button
              type="button"
              onClick={() => setActiveCategory("mine")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                activeCategory === "mine"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              My Notices ({stats.mine})
            </button>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="ml-auto h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Unable to display notices</p>
          <p className="mt-0.5 text-xs opacity-90">{error}</p>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && rawList.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        /* Empty States */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <IconBell size={26} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {hasActiveFilters
              ? "No matching announcements"
              : emptyStateMessage ?? "No campus notices published yet"}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {hasActiveFilters
              ? "We couldn't find any announcements matching your active search query or filter selection."
              : variant === "teacher"
              ? "Click 'New Announcement' to publish a class notice to the students you teach."
              : "Check back later for university updates, schedules, and important academic bulletins."}
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-4 shadow-2xs"
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        /* Notices Grid or List */
        <div
          className={cn(
            "grid gap-4",
            viewMode === "grid"
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 *:h-full"
              : "grid-cols-1"
          )}
        >
          {filteredList.map((item) => {
            const detail = toNoticeDetailData(item);
            return (
              <NoticePostCard
                key={item.id}
                notice={detail}
                onOpen={() => setSelectedNotice(detail)}
                compact={viewMode === "list"}
                actions={renderCardActions ? renderCardActions(detail, item) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <NoticeDetailModal
          notice={selectedNotice}
          onClose={() => setSelectedNotice(null)}
        />
      )}
    </div>
  );
}
