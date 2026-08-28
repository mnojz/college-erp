"use client";

import { AdminModal } from "@/app/components/admin/AdminModal";
import { formatBytes } from "@/app/lib/syllabi-shared";
import { ZoomableImageViewer } from "@/app/components/common/ZoomableImageViewer";
import {
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconPaperclip,
} from "@tabler/icons-react";

export type NoticeAttachment = {
  fileName: string;
  mimeType: string;
  size: number;
};

export type NoticeDetailData = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  author?: { firstName: string; lastName: string } | null;
  attachment?: NoticeAttachment | null;
};

/** Endpoint that streams a notice attachment (images/PDF). */
export function noticeAttachmentUrl(id: string, inline = false): string {
  return `/api/announcements/${id}/attachment${inline ? "?inline=1" : ""}`;
}

/**
 * Popup shown when clicking a notice/announcement card: full body plus an
 * attachment preview — images render inline, other formats get open/download
 * actions.
 */
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
      <div className="notice-detail">
        <div className="notice-detail-meta">
          <span className="badge badge-green">
            {new Date(stamp).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
          {notice.author && (
            <span className="notice-detail-author">
              Posted by {notice.author.firstName} {notice.author.lastName}
            </span>
          )}
          {attachment && (
            <span className="badge badge-blue">
              <IconPaperclip size={12} aria-hidden="true" /> Attachment
            </span>
          )}
        </div>

        <p className="notice-detail-body">{notice.body}</p>

        {attachment && (
          <div className="notice-detail-attachment">
            <span className="notice-detail-attachment-title">
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
                <a
                  className="notice-detail-download"
                  href={noticeAttachmentUrl(notice.id)}
                  download={attachment.fileName}
                >
                  <IconDownload size={14} aria-hidden="true" />
                  Download {attachment.fileName} ({formatBytes(attachment.size)})
                </a>
              </>
            ) : (
              <div className="notice-file-row">
                <span className="notice-file-row-icon">
                  <IconFileText size={22} aria-hidden="true" />
                </span>
                <span className="notice-file-row-info">
                  <span className="notice-file-row-name">{attachment.fileName}</span>
                  <span className="notice-file-row-size">
                    {formatBytes(attachment.size)}
                  </span>
                </span>
                <span className="notice-file-row-actions">
                  <a
                    className="btn-ghost"
                    href={noticeAttachmentUrl(notice.id, true)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconExternalLink size={15} aria-hidden="true" /> Open
                  </a>
                  <a
                    className="btn-primary"
                    href={noticeAttachmentUrl(notice.id)}
                    download={attachment.fileName}
                  >
                    <IconDownload size={15} aria-hidden="true" /> Download
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