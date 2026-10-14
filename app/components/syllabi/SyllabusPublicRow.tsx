"use client";

import { resolveTitle, formatBytes, formatDate, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { IconDownload, IconEye, IconFileTypePdf } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type Syllabus = SyllabusDto;

interface Props {
  syllabus: Syllabus;
  onPreview: () => void;
}

/**
 * Public syllabus document card with larger typography,
 * prominent icons, and on-page PDF preview trigger.
 */
export function SyllabusPublicRow({ syllabus, onPreview }: Props) {
  const title = resolveTitle(syllabus);

  return (
    <div className="group/row flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs">
      <div>
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <IconFileTypePdf size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onPreview}
              className="text-left font-semibold text-sm sm:text-base leading-snug text-foreground transition-colors hover:text-primary line-clamp-2"
              title={`Preview ${title}`}
            >
              {title}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground/80">{formatBytes(syllabus.fileSize)}</span>
              <span>•</span>
              <span>{formatDate(syllabus.updatedAt || syllabus.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/50 pt-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onPreview}
          title="Preview PDF"
          aria-label="Preview PDF"
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <IconEye size={16} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          asChild
          title="Download PDF"
          aria-label="Download PDF"
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <a href={`/api/syllabus/${syllabus.id}/file`} download>
            <IconDownload size={16} aria-hidden="true" />
          </a>
        </Button>
      </div>
    </div>
  );
}
