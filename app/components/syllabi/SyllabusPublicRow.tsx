"use client";

import { resolveTitle, formatBytes, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { IconDownload, IconEye } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type Syllabus = SyllabusDto;

interface Props {
  syllabus: Syllabus;
}

/**
 * Flat file entry rendered directly on its semester slot: title and size on
 * top, then a hairline separator and an evenly distributed action bar pinned
 * toward the bottom of the slot.
 */
export function SyllabusPublicRow({ syllabus }: Props) {
  return (
    <div className="flex flex-col py-2 first:pt-0.5 last:pb-0">
      <a
        href={`/api/syllabus/${syllabus.id}/file?inline=1`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0"
        title={`Preview ${resolveTitle(syllabus)}`}
      >
        <span className="block truncate text-sm font-medium leading-snug">
          {resolveTitle(syllabus)}
        </span>
      </a>
      <span className="mt-1 text-xs text-muted-foreground">{formatBytes(syllabus.fileSize)}</span>
      {/* Footer action bar — the hairline bleeds to the slot edges so the bar
          reads as the slot's footer rather than a continuation of the text. */}
      <div className="-mx-3 mt-1.5 border-t px-1 pt-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            title="Preview PDF"
            aria-label="Preview PDF"
            className="flex-1"
          >
            <a
              href={`/api/syllabus/${syllabus.id}/file?inline=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconEye size={16} aria-hidden="true" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            title="Download PDF"
            aria-label="Download PDF"
            className="flex-1"
          >
            <a href={`/api/syllabus/${syllabus.id}/file`} download>
              <IconDownload size={16} aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
