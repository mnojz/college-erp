"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatBytes } from "@/app/lib/syllabi-shared";
import {
  noticeAttachmentUrl,
  type NoticeDetailData,
} from "@/app/components/common/NoticeDetailModal";
import {
  NoticeContentRenderer,
  parseNoticeBody,
} from "@/app/components/common/NoticeContentRenderer";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconFileText,
  IconFileTypePdf,
  IconPaperclip,
  IconPhoto,
  IconPlayerPlay,
  IconZoomIn,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const videoFrameCache = new Map<string, string>();

function VideoThumbnail({
  src,
  noticeId,
  alt = "",
}: {
  src: string;
  noticeId: string;
  alt?: string;
}) {
  const [frameUrl, setFrameUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return videoFrameCache.get(noticeId) || sessionStorage.getItem(`video_frame_v3_${noticeId}`);
  });

  const videoRef = useRef<HTMLVideoElement>(null);

  const seekToMiddle = () => {
    const v = videoRef.current;
    if (!v) return;
    const duration = v.duration;
    if (Number.isFinite(duration) && duration > 0) {
      const mid = Math.max(0.5, duration / 2);
      if (Math.abs(v.currentTime - mid) > 0.3) {
        v.currentTime = mid;
      }
    }
  };

  const captureFrame = () => {
    if (frameUrl) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;

    try {
      const targetW = 240;
      const targetH = Math.round((v.videoHeight / (v.videoWidth || 1)) * targetW) || 160;
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(v, 0, 0, targetW, targetH);
      // Validate that the captured frame has actual pixels and is not completely black
      const imgData = ctx.getImageData(0, 0, Math.min(60, targetW), Math.min(60, targetH));
      const pixels = imgData.data;
      let hasColor = false;
      for (let i = 0; i < pixels.length; i += 16) {
        if (pixels[i] > 18 || pixels[i + 1] > 18 || pixels[i + 2] > 18) {
          hasColor = true;
          break;
        }
      }
      if (hasColor) {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        videoFrameCache.set(noticeId, dataUrl);
        try {
          sessionStorage.setItem(`video_frame_v3_${noticeId}`, dataUrl);
        } catch {
          // ignore quota limits
        }
        setFrameUrl(dataUrl);
      }
    } catch {
      // Canvas capture fallback: the video element continues displaying the middle frame
    }
  };

  const handleSeeked = () => {
    if ("requestVideoFrameCallback" in (videoRef.current || {})) {
      (videoRef.current as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(() => {
        captureFrame();
      });
    } else {
      setTimeout(captureFrame, 150);
    }
  };

  return (
    <div className="relative size-full overflow-hidden bg-neutral-950">
      {/* Background Frame / In-DOM Video */}
      {frameUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={frameUrl}
          alt={alt}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          preload="auto"
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          onLoadedMetadata={seekToMiddle}
          onCanPlay={seekToMiddle}
          onSeeked={handleSeeked}
          className="absolute inset-0 size-full object-cover pointer-events-none"
        />
      )}

      {/* Subtle dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      {/* Centered Play Icon */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex size-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-xs text-white border border-white/25 shadow-md transition-transform group-hover:scale-110">
          <IconPlayerPlay size={14} className="fill-white translate-x-0.5" />
        </div>
      </div>

      {/* Pill badge */}
      <span className="absolute bottom-1 right-1 z-10 text-[9px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-black/75 text-white/90">
        VIDEO
      </span>
    </div>
  );
}

function isRecent(dateString: string): boolean {
  try {
    const time = new Date(dateString).getTime();
    const diff = Date.now() - time;
    return diff > 0 && diff < 72 * 60 * 60 * 1000; // 3 days
  } catch {
    return false;
  }
}

function formatDisplayDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) {
      const mins = Math.max(1, Math.floor(diffHours * 60));
      return `${mins}m ago`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    }
    if (diffHours < 48) {
      return "Yesterday";
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateString;
  }
}

export function NoticePostCard({
  notice,
  onOpen,
  actions,
  compact = false,
}: {
  notice: NoticeDetailData;
  onOpen: () => void;
  actions?: ReactNode;
  /** Denser variant for multi-column grids or dashboard widgets. */
  compact?: boolean;
}) {
  const attachment = notice.attachment ?? null;
  const isVideo =
    !!attachment &&
    (attachment.mimeType.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(attachment.fileName));
  const isImage =
    !isVideo &&
    !!attachment &&
    (attachment.mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(attachment.fileName));
  const isPdf =
    !isVideo &&
    !isImage &&
    !!attachment &&
    (attachment.mimeType === "application/pdf" || /\.pdf$/i.test(attachment.fileName));

  const parsed = useMemo(() => parseNoticeBody(notice.body), [notice.body]);
  const hasRoutineOrTable = !!parsed.table;

  const stamp = notice.publishedAt ?? notice.createdAt;
  const isNew = isRecent(stamp);
  const authorName = notice.author
    ? `${notice.author.firstName} ${notice.author.lastName}`.trim()
    : "Campus Administration";
  const initials = (
    `${notice.author?.firstName?.[0] ?? ""}${notice.author?.lastName?.[0] ?? ""}`
  ).toUpperCase() || "CA";

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
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-0 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        compact && "text-sm"
      )}
    >
      {/* Upper header: PFP, Author name, Date / Class, NEW badge & Actions */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/15 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Avatar (PFP) — slightly bigger */}
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20"
            aria-hidden="true"
          >
            {initials}
          </div>

          {/* Author Name & Subtitle */}
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-foreground leading-tight">
              {authorName}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <span>{formatDisplayDate(stamp)}</span>
              {notice.scope && (
                <>
                  <span>•</span>
                  <span className="font-medium text-foreground/75 truncate">
                    {notice.scope.programCode} Sem {notice.scope.semester}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side: NEW badge & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              NEW
            </span>
          )}

          {actions && (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Middle section — Title (single row), body text right below, attachment/routine row, and file preview */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-4 flex-1">
          <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
            <div>
              {/* Title: strictly single row */}
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {notice.title}
              </h3>

              {/* Body text right below title with fixed gap */}
              <div className="mt-1.5">
                <NoticeContentRenderer body={notice.body} mode="preview" compact={compact} />
              </div>
            </div>

            {/* Bottom Row under body text: Attachment info with color highlight & Routine indicator */}
            {(attachment || hasRoutineOrTable) && (
              <div className="mt-3 pt-1 flex flex-wrap items-center gap-2">
                {/* Routine indicator with color highlight */}
                {hasRoutineOrTable && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                    <IconCalendarEvent size={13} className="shrink-0 text-purple-600 dark:text-purple-400" />
                    <span>{parsed.table?.isRoutine ? "Exam Routine Schedule" : "Table Data Included"}</span>
                  </span>
                )}

                {/* Attachment info with color highlight */}
                {attachment && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium truncate max-w-full",
                      isVideo
                        ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : isImage
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        : isPdf
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    )}
                    title={`${attachment.fileName} (${formatBytes(attachment.size)})`}
                  >
                    {isVideo ? (
                      <IconPlayerPlay size={13} className="shrink-0 text-rose-500 fill-rose-500/30" />
                    ) : isImage ? (
                      <IconPhoto size={13} className="shrink-0 text-sky-500" />
                    ) : isPdf ? (
                      <IconFileTypePdf size={14} className="shrink-0 text-red-500" />
                    ) : (
                      <IconPaperclip size={13} className="shrink-0 text-amber-500" />
                    )}
                    <span className="truncate max-w-[160px] sm:max-w-[200px] font-medium">{attachment.fileName}</span>
                    <span className="text-[10px] opacity-70 font-mono shrink-0">
                      {formatBytes(attachment.size)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Larger File Preview Box */}
          {attachment && (
            <div
              className="relative w-24 h-20 sm:w-28 sm:h-22 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted/40 transition-transform group-hover:scale-[1.02]"
              aria-hidden="true"
              title={`${attachment.fileName} · ${formatBytes(attachment.size)}`}
            >
              {isVideo ? (
                <VideoThumbnail
                  src={noticeAttachmentUrl(notice.id, true)}
                  noticeId={notice.id}
                  alt={notice.title}
                />
              ) : isImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={noticeAttachmentUrl(notice.id, true)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground p-2">
                  <IconFileText size={22} className="text-primary/75" aria-hidden="true" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">
                    {attachment.fileName.split(".").pop()?.slice(0, 4) ?? "FILE"}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {formatBytes(attachment.size)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <IconZoomIn size={18} aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom footer — Subject info & prompt */}
      <div className="flex items-center justify-between border-t border-border/50 bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground mt-auto">
        <span className="truncate max-w-[240px]">
          {notice.scope?.subjectName ? (
            <span className="font-medium text-foreground/80">
              {notice.scope.subjectName}
            </span>
          ) : (
            <span className="text-muted-foreground/70">General Campus Notice</span>
          )}
        </span>

        <span className="flex items-center gap-1 font-semibold text-primary transition-transform group-hover:translate-x-0.5 shrink-0 ml-2">
          <span>{hasRoutineOrTable ? "View routine" : isVideo ? "Watch video" : "Read notice"}</span>
          <IconArrowRight size={13} aria-hidden="true" />
        </span>
      </div>
    </Card>
  );
}
