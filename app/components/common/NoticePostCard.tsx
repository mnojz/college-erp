"use client";

import type { ReactNode } from "react";
import { formatBytes } from "@/app/lib/syllabi-shared";
import {
  noticeAttachmentUrl,
  type NoticeDetailData,
} from "@/app/components/common/NoticeDetailModal";
import { IconFileText, IconZoomIn } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { cn } from "cn";

export function NoticePostCard({
  notice,
  onOpen,
  actions,
  compact = false,
}: {
  notice: NoticeDetailData;
  onOpen: () => void;
  actions?: ReactNode;
  /** Denser variant for multi-column grids (smaller thumb, shorter body). */
  compact?: boolean;
}) {
  const attachment = notice.attachment ?? null;
  const isImage = !!attachment && attachment.mimeType.startsWith("image/");
  const stamp = notice.publishedAt ?? notice.createdAt;
  const authorName = notice.author
    ? `${notice.author.firstName} ${notice.author.lastName}`.trim()
    : "Administration";
  const initials = (
    `${notice.author?.firstName?.[0] ?? ""}${notice.author?.lastName?.[0] ?? ""}`
  ).toUpperCase();

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer overflow-hidden p-0 transition-colors hover:border-ring hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact && "[&_.notice-body]:line-clamp-2"
      )}
    >
      {/* Upper section — poster info + edit/delete controls (admin/owner). */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
            aria-hidden="true"
          >
            {initials || <IconFileText size={16} aria-hidden="true" />}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{authorName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(stamp).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>

      {/* Lower section — the actual notice content, below the divider. */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="notice-body mb-1 text-sm font-semibold leading-snug">{notice.title}</h3>
          <p className="line-clamp-3 text-sm text-muted-foreground">{notice.body}</p>
        </div>

        {attachment && (
          <div
            className="relative flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted/40"
            aria-hidden="true"
            title={`${attachment.fileName} · ${formatBytes(attachment.size)}`}
          >
            {isImage ? (
              /* eslint-disable-next-line @next/next/no-img-element -- attachment streamed by our own API */
              <img
                src={noticeAttachmentUrl(notice.id, true)}
                alt=""
                loading="lazy"
                draggable={false}
                className="size-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center gap-0.5 text-muted-foreground">
                <IconFileText size={20} aria-hidden="true" />
                <small className="text-[9px] font-semibold uppercase">
                  {attachment.fileName.split(".").pop()?.slice(0, 4) ?? "FILE"}
                </small>
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-background/50 text-foreground opacity-0 transition-opacity hover:opacity-100">
              <IconZoomIn size={16} aria-hidden="true" />
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
