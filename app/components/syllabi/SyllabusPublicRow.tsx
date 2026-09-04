"use client";

import { resolveTitle, formatBytes, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { IconDownload, IconEye } from "@tabler/icons-react";

type Syllabus = SyllabusDto;

interface Props {
  syllabus: Syllabus;
}

/** A single syllabus entry in the student library — preview & download. */
export function SyllabusPublicRow({ syllabus }: Props) {
  return (
    <article className="syllabus-admin-row">
      <a
        href={`/api/syllabus/${syllabus.id}/file?inline=1`}
        target="_blank"
        rel="noopener noreferrer"
        className="syllabus-admin-link"
        title={`Preview ${resolveTitle(syllabus)}`}
      >
        <span className="syllabus-admin-title">{resolveTitle(syllabus)}</span>
        <span className="syllabus-admin-meta">
          {syllabus.programCode ?? "—"} · Sem {syllabus.semester} ·{" "}
          {formatBytes(syllabus.fileSize)}
        </span>
      </a>
      <div className="syllabus-admin-actions">
        <a
          href={`/api/syllabus/${syllabus.id}/file?inline=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost btn-small"
          title="Preview PDF"
          aria-label="Preview PDF"
        >
          <IconEye size={16} aria-hidden="true" />
        </a>
        <a
          href={`/api/syllabus/${syllabus.id}/file`}
          download
          className="btn-ghost btn-small"
          title="Download PDF"
          aria-label="Download PDF"
        >
          <IconDownload size={16} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

