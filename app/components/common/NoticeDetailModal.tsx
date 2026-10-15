"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/app/lib/syllabi-shared";
import { ZoomableImageViewer } from "@/app/components/common/ZoomableImageViewer";
import { CustomVideoPlayer } from "@/app/components/common/CustomVideoPlayer";
import { NoticeContentRenderer } from "@/app/components/common/NoticeContentRenderer";
import {
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconPaperclip,
  IconPhoto,
  IconPlayerPlay,
} from "@tabler/icons-react";

export type NoticeAttachment = {
  fileName: string;
  mimeType: string;
  size: number;
};

/** Target teaching group for a teacher-scoped notice (subject × program × semester). */
export type NoticeScope = {
  subjectName: string;
  subjectCode: string;
  programName: string;
  programCode: string;
  semester: number;
};

export type NoticeDetailData = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  authorId?: string;
  teacherId?: string | null;
  author?: { firstName: string; lastName: string } | null;
  attachment?: NoticeAttachment | null;
  /** Present only for notices a teacher published to a specific class. */
  scope?: NoticeScope | null;
};

/** Endpoint that streams a notice attachment (images/PDF/video). */
export function noticeAttachmentUrl(id: string, inline = false): string {
  return `/api/announcements/${id}/attachment${inline ? "?inline=1" : ""}`;
}

function formatNoticeDate(stamp: string | null): string {
  if (!stamp) return "Recently";
  try {
    const d = new Date(stamp);
    return `${d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })} at ${d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return stamp;
  }
}

export function NoticeDetailModal({
  notice,
  onClose,
}: {
  notice: NoticeDetailData;
  onClose: () => void;
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
    !!attachment &&
    (attachment.mimeType === "application/pdf" || /\.pdf$/i.test(attachment.fileName));

  const stamp = notice.publishedAt ?? notice.createdAt;
  const authorName = notice.author
    ? `${notice.author.firstName} ${notice.author.lastName}`.trim()
    : "Campus Administration";
  const initials = (
    `${notice.author?.firstName?.[0] ?? ""}${notice.author?.lastName?.[0] ?? ""}`
  ).toUpperCase() || "CA";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl w-full p-6 flex flex-col gap-5">
        <DialogTitle className="sr-only">{notice.title}</DialogTitle>

        {/* Author & Timestamp Header at the top (no card, no background, border-bottom separator) */}
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 pr-10">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {authorName}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <span>Published on {formatNoticeDate(stamp)}</span>
              {notice.scope && (
                <>
                  <span>•</span>
                  <span className="font-medium text-foreground/80">
                    {notice.scope.programCode} · Sem {notice.scope.semester} · {notice.scope.subjectName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Title and Body text together (clean, no card-like UI) */}
        <div className="flex flex-col gap-3.5 select-text">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
            {notice.title}
          </h2>
          <div className="text-sm leading-relaxed text-foreground/90">
            <NoticeContentRenderer body={notice.body} mode="full" />
          </div>
        </div>

        {/* Attachment Card (Adaptive by Media Type) */}
        {attachment && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isVideo ? (
                <>
                  <IconPlayerPlay size={14} className="text-rose-500" aria-hidden="true" />
                  <span>Attached Video</span>
                </>
              ) : isImage ? (
                <>
                  <IconPhoto size={14} className="text-sky-500" aria-hidden="true" />
                  <span>Attached Image</span>
                </>
              ) : (
                <>
                  <IconPaperclip size={14} className="text-primary" aria-hidden="true" />
                  <span>{isPdf ? "Attached PDF Document" : "Attached File"}</span>
                </>
              )}
            </span>

            {/* Video Player */}
            {isVideo ? (
              <div className="flex flex-col gap-2.5">
                <CustomVideoPlayer
                  src={noticeAttachmentUrl(notice.id, true)}
                  title={attachment.fileName}
                  downloadName={attachment.fileName}
                  openUrl={noticeAttachmentUrl(notice.id, true)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span>
                    {attachment.fileName} ({formatBytes(attachment.size)})
                  </span>
                  <a href={noticeAttachmentUrl(notice.id)} download={attachment.fileName}>
                    <Button variant="outline" size="sm" className="gap-1.5 shadow-xs">
                      <IconDownload size={14} aria-hidden="true" />
                      Download Video
                    </Button>
                  </a>
                </div>
              </div>
            ) : isImage ? (
              /* Image Viewer */
              <div className="flex flex-col gap-2.5">
                <ZoomableImageViewer
                  src={noticeAttachmentUrl(notice.id, true)}
                  alt={attachment.fileName}
                  openUrl={noticeAttachmentUrl(notice.id, true)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {attachment.fileName} ({formatBytes(attachment.size)})
                  </span>
                  <a href={noticeAttachmentUrl(notice.id)} download={attachment.fileName}>
                    <Button variant="outline" size="sm" className="gap-1.5 shadow-xs">
                      <IconDownload size={14} aria-hidden="true" />
                      Download Image
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              /* Document / PDF Card */
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IconFileText size={20} aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {attachment.fileName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {attachment.fileName.split(".").pop()?.toUpperCase() ?? "FILE"} • {formatBytes(attachment.size)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={noticeAttachmentUrl(notice.id, true)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <IconExternalLink size={14} aria-hidden="true" /> Open
                    </Button>
                  </a>
                  <a href={noticeAttachmentUrl(notice.id)} download={attachment.fileName}>
                    <Button size="sm" className="gap-1.5">
                      <IconDownload size={14} aria-hidden="true" /> Download
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
