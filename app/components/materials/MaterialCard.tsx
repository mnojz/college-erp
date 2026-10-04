"use client";

import type { StudyMaterialDto } from "@/app/lib/materials-shared";
import {
  formatBytes,
  formatDate,
  MATERIAL_TYPE_STYLE,
  materialTypeLabel,
} from "@/app/lib/materials-shared";
import { IconFileText, IconStar, IconStarFilled } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type MaterialCardProps = {
  material: StudyMaterialDto;
  onToggleBookmark: (id: string) => void;
  onOpenDetails: (material: StudyMaterialDto) => void;
};

function startDownload(id: string) {
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
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span
            className="flex size-10 items-center justify-center rounded-lg text-sm font-bold"
            style={{ background: style.bg, color: style.color }}
          >
            {style.monogram}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleBookmark(material.id)}
            aria-label={material.bookmarked ? "Remove bookmark" : "Bookmark this material"}
            title={material.bookmarked ? "Remove bookmark" : "Bookmark"}
            className={material.bookmarked ? "text-[var(--ctp-yellow)]" : "text-muted-foreground"}
          >
            {material.bookmarked ? (
              <IconStarFilled size={16} aria-hidden="true" />
            ) : (
              <IconStar size={16} aria-hidden="true" />
            )}
          </Button>
        </div>

        <div className="mb-1 flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className="border-transparent"
            style={{ background: style.bg, color: style.color }}
          >
            {materialTypeLabel(material.materialType)}
          </Badge>
        </div>

        <h3
          className="mb-2 cursor-pointer text-base font-semibold hover:text-primary"
          onClick={() => onOpenDetails(material)}
        >
          {material.title}
        </h3>

        <div className="mb-2 flex flex-wrap gap-1.5">
          {material.subject ? (
            <Badge variant="secondary" className="bg-sky-500/10 text-sky-700 dark:text-sky-300">
              {material.subject.code}
            </Badge>
          ) : (
            <Badge variant="secondary">General</Badge>
          )}
          {material.topic && <Badge variant="outline">{material.topic}</Badge>}
          {material.semester != null && <Badge variant="outline">Sem {material.semester}</Badge>}
        </div>

        {material.description && (
          <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{material.description}</p>
        )}

        <p className="mb-3 text-xs text-muted-foreground">
          {material.uploader.name}
          <span className="mx-1">·</span>
          {material.program ? material.program.code : material.departmentName ?? "College-wide"}
          {material.subject && (
            <>
              <span className="mx-1">·</span>
              {material.subject.name}
            </>
          )}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={material.fileName}>
            <IconFileText size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{material.fileName}</span>
            <small className="shrink-0">
              {formatBytes(material.fileSize)} · {formatDate(material.createdAt)}
            </small>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => startDownload(material.id)}>
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
