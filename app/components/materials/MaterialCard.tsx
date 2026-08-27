"use client";

import type { StudyMaterialDto } from "@/app/lib/materials-shared";
import {
  formatBytes,
  formatDate,
  MATERIAL_TYPE_STYLE,
  materialTypeLabel,
} from "@/app/lib/materials-shared";

type MaterialCardProps = {
  material: StudyMaterialDto;
  onToggleBookmark: (id: string) => void;
  onOpenDetails: (material: StudyMaterialDto) => void;
};

function startDownload(id: string) {
  // Content-Disposition: attachment on the API route drives a real download;
  // this keeps us off the router while avoiding window.location navigation.
  const link = document.createElement("a");
  link.href = `/api/materials/${id}/file`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function MaterialCard({ material, onToggleBookmark, onOpenDetails }: MaterialCardProps) {
  const style = MATERIAL_TYPE_STYLE[material.materialType] ?? MATERIAL_TYPE_STYLE.OTHER;

  return (
    <article className="note-card">
      <div className="note-card-top">
        <span className="note-monogram" style={{ background: style.bg, color: style.color }}>
          {style.monogram}
        </span>
        <div className="note-card-top-right">
          <span className="type-pill" style={{ background: style.bg, color: style.color }}>
            {materialTypeLabel(material.materialType)}
          </span>
          <button
            type="button"
            className={`bookmark-btn${material.bookmarked ? " is-bookmarked" : ""}`}
            onClick={() => onToggleBookmark(material.id)}
            aria-label={material.bookmarked ? "Remove bookmark" : "Bookmark this material"}
            title={material.bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {material.bookmarked ? "★" : "☆"}
          </button>
        </div>
      </div>

      <h3 className="note-card-title" onClick={() => onOpenDetails(material)}>
        {material.title}
      </h3>

      <div className="note-card-chips">
        {material.subject ? (
          <span className="chip chip-sky">{material.subject.code}</span>
        ) : (
          <span className="chip">General</span>
        )}
        {material.topic && <span className="chip">{material.topic}</span>}
        {material.semester != null && <span className="chip">Sem {material.semester}</span>}
      </div>

      {material.description && (
        <p className="note-card-desc">{material.description}</p>
      )}

      <div className="note-card-meta">
        <span>{material.uploader.name}</span>
        <span>·</span>
        <span>{material.program ? material.program.code : material.departmentName ?? "College-wide"}</span>
        {material.subject && (
          <>
            <span>·</span>
            <span className="note-card-subject-name">{material.subject.name}</span>
          </>
        )}
      </div>

      <div className="note-card-footer">
        <div className="note-file-meta" title={material.fileName}>
          📄 {material.fileName}
          <small>
            {formatBytes(material.fileSize)} · {formatDate(material.createdAt)}
          </small>
        </div>
        <button type="button" className="btn-download" onClick={() => startDownload(material.id)}>
          Download
        </button>
      </div>
    </article>
  );
}
