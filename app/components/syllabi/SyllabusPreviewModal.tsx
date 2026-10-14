"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBytes, resolveTitle, type SyllabusDto } from "@/app/lib/syllabi-shared";
import { IconDownload, IconExternalLink, IconFileTypePdf } from "@tabler/icons-react";
import { CustomPdfViewer } from "@/app/components/common/CustomPdfViewer";

interface Props {
  syllabus: SyllabusDto | null;
  onClose: () => void;
}

function SyllabusPreviewBody({ syllabus }: { syllabus: SyllabusDto }) {
  const title = resolveTitle(syllabus);
  const fileUrl = `/api/syllabus/${syllabus.id}/file`;
  const previewUrl = `${fileUrl}?inline=1`;

  return (
    <DialogContent className="flex h-[92vh] max-h-[94vh] w-[96vw] max-w-7xl sm:max-w-7xl lg:max-w-[92vw] xl:max-w-[1400px] flex-col p-4 sm:p-5 gap-3">
      <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-3 pr-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <IconFileTypePdf size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="truncate text-base sm:text-lg font-bold text-foreground">
              {title}
            </DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              {syllabus.programName ? `${syllabus.programName} • ` : ""}
              Semester {syllabus.semester} • {formatBytes(syllabus.fileSize)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hidden sm:inline-flex"
          >
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <IconExternalLink size={14} aria-hidden="true" />
              Open raw
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <a href={fileUrl} download>
              <IconDownload size={14} aria-hidden="true" />
              Download
            </a>
          </Button>
        </div>
      </DialogHeader>

      {/* Custom PDF Canvas Viewer */}
      <div className="relative flex-1 overflow-hidden">
        <CustomPdfViewer
          url={previewUrl}
          title={title}
          downloadUrl={fileUrl}
          className="border border-border/60"
        />
      </div>
    </DialogContent>
  );
}

export function SyllabusPreviewModal({ syllabus, onClose }: Props) {
  if (!syllabus) return null;

  return (
    <Dialog open={!!syllabus} onOpenChange={(open) => !open && onClose()}>
      <SyllabusPreviewBody key={syllabus.id} syllabus={syllabus} />
    </Dialog>
  );
}

