"use client";

import type { ReactNode } from "react";
import { formatBytes } from "@/app/lib/syllabi-shared";
import {
  noticeAttachmentUrl,
  type NoticeDetailData,
} from "@/app/components/common/NoticeDetailModal";
import { IconBell, IconBook2, IconFileText, IconZoomIn } from "@tabler/icons-react";

/**
 * Post-style notice card with two sections separated by a fine divider:
 *  - header: poster byline (avatar, name, date, scope chip) with the optional
 *    `actions` slot (edit/delete controls) pinned to the right edge;
 *  - body: notice title, short body text and a small square attachment
 *    preview, vertically centered against the text.
 * Clicking the card opens the detail popup, where the full image is shown
 * with a zoom/pan viewer.
 */
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
    <article
      className={`notice-post clickable-card${compact ? " notice-post-compact" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {/* Upper section — poster info + edit/delete controls (admin/owner). */}
      <div className="notice-post-head">
        <div className="notice-post-byline-group">
          <span className="notice-post-avatar" aria-hidden="true">
            {initials ? initials : <IconBell size={18} aria-hidden="true" />}
          </span>
          <div className="notice-post-byline">
            <span className="notice-post-author">{authorName}</span>
            <span className="notice-post-date">
              {new Date(stamp).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            {notice.scope && (
              <span
                className="notice-post-scope"
                title={`${notice.scope.subjectName} · ${notice.scope.programName} · Semester ${notice.scope.semester}`}
              >
                <IconBook2 size={11} aria-hidden="true" />
                {notice.scope.subjectCode} · {notice.scope.programCode} · Sem {notice.scope.semester}
              </span>
            )}
          </div>
        </div>

        {actions && (
          <div
            className="notice-post-actions"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Lower section — the actual notice content, below the divider. */}
      <div className="notice-post-main">
        <div className="notice-post-text">
          <h3 className="notice-post-title">{notice.title}</h3>
          <p className="notice-post-body">{notice.body}</p>
        </div>

        {attachment && (
          <div
            className="notice-post-thumb"
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
              />
            ) : (
              <span className="notice-post-thumb-file">
                <IconFileText size={24} aria-hidden="true" />
                <small>
                  {attachment.fileName.split(".").pop()?.slice(0, 4) ?? "FILE"}
                </small>
              </span>
            )}
            <span className="notice-post-thumb-overlay">
              <IconZoomIn size={16} aria-hidden="true" />
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
