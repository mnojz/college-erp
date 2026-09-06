"use client";

import { AdminModal } from "@/app/components/admin/AdminModal";
import { formatBytes } from "@/app/lib/syllabi-shared";
import { ZoomableImageViewer } from "@/app/components/common/ZoomableImageViewer";
import {
  IconBook2,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconPaperclip,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  author?: { firstName: string; lastName: string } | null;
  attachment?: NoticeAttachment | null;
  /** Present only for notices a teacher published to a specific class. */
  scope?: NoticeScope | null;
};

/** Endpoint that streams a notice attachment (images/PDF). */
export function noticeAttachmentUrl(id: string, inline = false): string {
  return `/api/announcements/${id}/attachment${inline ? "?inline=1" : ""}`;
}

export function NoticeDetailModal({
  notice,
  onClose,
}: {
  notice: NoticeDetailData;
  onClose: () => void;
}) {
  const attachment = notice.attachment ?? null;
  const isImage = !!attachment && attachment.mimeType.startsWith("image/");
  const stamp = notice.publishedAt ?? notice.createdAt;

  return (
    <AdminModal title={notice.title} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {new Date(stamp).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Badge>
          {notice.author && (
            <span className="text-sm text-muted-foreground">
              Posted by {notice.author.firstName} {notice.author.lastName}
            </span>
          )}
          {notice.scope && (
            <Badge variant="outline" title={notice.scope.subjectName} className="gap-1">
              <IconBook2 size={12} aria-hidden="true" />
              {notice.scope.subjectCode} · {notice.scope.programCode} · Sem {notice.scope.semester}
            </Badge>
          )}
          {attachment && (
            <Badge variant="secondary" className="gap-1">
              <IconPaperclip size={12} aria-hidden="true" /> Attachment
            </Badge>
          )}
        </div>

        <p className="text-[15px] leading-relaxed text-muted-foreground">{notice.body}</p>

        {attachment && (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <IconPaperclip size={14} aria-hidden="true" />
              {isImage ? "Attached image" : "Attached file"}
            </span>

            {isImage ? (
              <>
                <ZoomableImageViewer
                  src={noticeAttachmentUrl(notice.id, true)}
                  alt={attachment.fileName}
                  openUrl={noticeAttachmentUrl(notice.id, true)}
                />
                <a href={noticeAttachmentUrl(notice.id)} download={attachment.fileName}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <IconDownload size={14} aria-hidden="true" />
                    Download {attachment.fileName} ({formatBytes(attachment.size)})
                  </Button>
                </a>
              </>
            ) : (
              <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconFileText size={22} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{attachment.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(attachment.size)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <a
                    href={noticeAttachmentUrl(notice.id, true)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <IconExternalLink size={15} aria-hidden="true" /> Open
                    </Button>
                  </a>
                  <a href={noticeAttachmentUrl(notice.id)} download={attachment.fileName}>
                    <Button size="sm" className="gap-1.5">
                      <IconDownload size={15} aria-hidden="true" /> Download
                    </Button>
                  </a>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminModal>
  );
}
