"use client";

import type { StudyMaterialDto } from "@/app/lib/materials-shared";
import {
  formatBytes,
  MATERIAL_TYPE_STYLE,
  materialTypeLabel,
} from "@/app/lib/materials-shared";
import { IconDownload, IconStar, IconStarFilled } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { getFileIconInfo } from "@/app/components/materials/material-file-icon";

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
  const fileInfo = getFileIconInfo(material.fileName);

  return (
    <Card
      onClick={() => onOpenDetails(material)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md cursor-pointer"
    >
      <div className="flex flex-col gap-2">
        {/* Top Row: Category badge & Subject on left, Bookmark & Download on right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="border-transparent text-[11px] font-semibold py-0.5 px-2"
              style={{ background: style.bg, color: style.color }}
            >
              {materialTypeLabel(material.materialType)}
            </Badge>

            {material.subject && (
              <span className="text-xs font-semibold text-foreground/80 truncate">
                {material.subject.code}
                {material.semester != null && (
                  <span className="font-normal text-muted-foreground"> · Sem {material.semester}</span>
                )}
              </span>
            )}
          </div>

          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onToggleBookmark(material.id)}
              aria-label={material.bookmarked ? "Remove bookmark" : "Bookmark this material"}
              title={material.bookmarked ? "Remove bookmark" : "Bookmark"}
              className={cn(
                "size-7 cursor-pointer",
                material.bookmarked ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {material.bookmarked ? (
                <IconStarFilled size={15} aria-hidden="true" />
              ) : (
                <IconStar size={15} aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => startDownload(material.id)}
              title="Download file"
              aria-label={`Download ${material.title}`}
            >
              <IconDownload size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Title */}
        <div>
          <h3
            className="text-sm font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1"
            title={material.title}
          >
            {material.title}
          </h3>
          {material.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {material.description}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Row: File Attachment Chip (tiled icon, bigger visibility, no date) */}
      <div className="mt-2.5 flex items-stretch justify-between overflow-hidden rounded-xl border border-border/70 bg-muted/20 text-xs transition-colors group-hover:bg-muted/40 group-hover:border-border">
        <div className="flex items-center min-w-0 flex-1">
          <div
            className={cn(
              "flex w-12 shrink-0 items-center justify-center self-stretch border-r transition-colors",
              fileInfo.bg
            )}
          >
            <fileInfo.Icon size={26} className={fileInfo.color} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="flex flex-col justify-center min-w-0 px-3 py-2">
            <span className="truncate font-semibold text-foreground/90 text-xs" title={material.fileName}>
              {material.fileName}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {formatBytes(material.fileSize)}
            </span>
          </div>
        </div>

        <div className="flex items-center pr-3 shrink-0">
          <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
            {material.uploader.name}
          </span>
        </div>
      </div>
    </Card>
  );
}
