"use client";

import { formatBytes, resolveTitle, type SyllabusDto } from "@/app/lib/syllabi-shared";

type Syllabus = SyllabusDto;

interface Props {
  syllabus: Syllabus;
  onEdit: () => void;
  onDelete: () => void;
}

/** A single syllabus row in the admin list — preview, download, edit, delete. */
export function SyllabusAdminRow({ syllabus, onEdit, onDelete }: Props) {
  return (
    <article className="syllabus-admin-row">
      <a
        href={`/api/syllabi/${syllabus.id}/file?inline=1`}
        target="_blank"
        rel="noopener noreferrer"
        className="syllabus-admin-link"
        title="Preview PDF"
      >
        <span className="syllabus-admin-title">{resolveTitle(syllabus)}</span>
        <span className="syllabus-admin-meta">
          {syllabus.programCode ?? "—"} · Sem {syllabus.semester} · {formatBytes(syllabus.fileSize)}
        </span>
      </a>
      <div className="syllabus-admin-actions">
        <a
          href={`/api/syllabi/${syllabus.id}/file`}
          download
          className="btn-ghost btn-small"
          title="Download PDF"
        >
          ↓
        </a>
        <button type="button" className="btn-ghost btn-small" onClick={onEdit} title="Edit">
          ✎
        </button>
        <button type="button" className="btn-danger-ghost btn-small" onClick={onDelete} title="Delete">
          ✕
        </button>
      </div>
    </article>
  );
}
