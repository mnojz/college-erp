"use client";

import { useEffect, useState } from "react";
import type { StudyMaterialDto } from "@/app/lib/materials-shared";
import { formatBytes, formatDate, materialTypeLabel } from "@/app/lib/materials-shared";
import { CustomPdfViewer } from "@/app/components/common/CustomPdfViewer";
import { ZoomableImageViewer } from "@/app/components/common/ZoomableImageViewer";
import { CustomVideoPlayer } from "@/app/components/common/CustomVideoPlayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconAlertCircle,
  IconBook2,
  IconCheck,
  IconCode,
  IconCopy,
  IconDownload,
  IconMusic,
  IconPencil,
  IconStarFilled,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { getFileIconInfo } from "@/app/components/materials/material-file-icon";

export type MaterialPreviewModalProps = {
  material: StudyMaterialDto | null;
  onClose: () => void;
  onEdit?: (material: StudyMaterialDto) => void;
};

export type FileCategory = "pdf" | "image" | "text" | "audio" | "video" | "unsupported";

function categorizeFile(fileName: string, mimeType?: string | null): FileCategory {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split(".").pop() ?? "";
  const lowerMime = (mimeType ?? "").toLowerCase();

  // Explicitly block Office documents, archives, and binaries from being read as text
  if (
    [
      "doc", "docx", "dot", "dotx", "docm",
      "ppt", "pptx", "pot", "potx", "pps", "ppsx", "pptm",
      "xls", "xlsx", "xlt", "xltx", "xlsm",
      "odt", "odp", "ods", "rtf",
      "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
      "exe", "dll", "bin", "iso", "dmg", "apk"
    ].includes(ext)
  ) {
    return "unsupported";
  }

  // PDF
  if (ext === "pdf" || lowerMime === "application/pdf") {
    return "pdf";
  }

  // Image
  if (
    ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"].includes(ext) ||
    lowerMime.startsWith("image/")
  ) {
    return "image";
  }

  // Video
  if (
    ["mp4", "webm", "mov", "mkv", "avi", "ogv", "m4v", "wmv"].includes(ext) ||
    lowerMime.startsWith("video/")
  ) {
    return "video";
  }

  // Audio
  if (
    ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma", "opus"].includes(ext) ||
    lowerMime.startsWith("audio/")
  ) {
    return "audio";
  }

  // Text & Code - Strictly verify extension is a known text/source format
  const textExtensions = [
    "txt", "md", "markdown", "log", "csv", "tsv", "json", "yaml", "yml", "xml",
    "env", "ini", "conf", "toml",
    "js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "java", "c", "cpp", "cc",
    "h", "hpp", "cs", "sh", "bash", "zsh", "sql", "html", "htm", "css", "scss",
    "less", "php", "rb", "go", "rs", "swift", "kt", "kts", "dart", "lua", "r"
  ];

  if (textExtensions.includes(ext)) {
    return "text";
  }

  // Fallback check for safe plain text mime
  if (
    lowerMime.startsWith("text/") &&
    !lowerMime.includes("octet-stream") &&
    !lowerMime.includes("officedocument")
  ) {
    return "text";
  }

  return "unsupported";
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toUpperCase() ?? "FILE" : "FILE";
}

function TextFilePreviewer({ url, fileName }: { url: string; fileName: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchText() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Unable to read text file");
        const text = await res.text();
        if (!cancelled) setContent(text);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error reading file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchText();
    return () => {
      cancelled = true;
    };
  }, [url]);

  function handleCopy() {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-75 items-center justify-center rounded-xl border border-border/70 bg-card p-8">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs font-medium">Loading text preview…</span>
        </div>
      </div>
    );
  }

  if (error || content === null) {
    return (
      <div className="flex h-full min-h-60 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">
        <div className="flex flex-col items-center gap-2">
          <IconAlertCircle size={24} aria-hidden="true" />
          <p className="font-semibold">{error ?? "Failed to preview text file"}</p>
          <a href={url} download={fileName} className="mt-2">
            <Button size="sm" variant="outline" className="gap-1.5">
              <IconDownload size={14} aria-hidden="true" />
              Download instead
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const lines = content.split("\n");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 font-mono text-muted-foreground">
          <IconCode size={14} aria-hidden="true" className="text-primary" />
          <span>{fileName}</span>
          <span>•</span>
          <span>{lines.length} lines</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1 text-[11px] shadow-2xs"
        >
          {copied ? (
            <>
              <IconCheck size={13} className="text-emerald-500" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <IconCopy size={13} aria-hidden="true" />
              <span>Copy content</span>
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed select-text bg-muted/10">
        <pre className="text-foreground/90 whitespace-pre-wrap wrap-break-word">{content}</pre>
      </div>
    </div>
  );
}

export function MaterialPreviewModal({ material, onClose, onEdit }: MaterialPreviewModalProps) {
  if (!material) return null;

  const fileUrl = `/api/materials/${material.id}/file`;
  const inlineUrl = `/api/materials/${material.id}/file?inline=1`;
  const category = categorizeFile(material.fileName, material.mimeType);
  const isSupported = category !== "unsupported";
  const extension = getFileExtension(material.fileName);
  const fileInfo = getFileIconInfo(material.fileName);

  return (
    <Dialog open={!!material} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-3 rounded-2xl border-border/80 shadow-2xl transition-all duration-200",
          isSupported
            ? "h-[92vh] max-h-[94vh] w-[96vw] max-w-7xl sm:max-w-7xl lg:max-w-[92vw] xl:max-w-350 p-4 sm:p-5"
            : "w-[90vw] max-w-107.5 p-5"
        )}
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-3 pr-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg border font-bold text-sm",
                fileInfo.bg
              )}
            >
              <fileInfo.Icon size={22} className={fileInfo.color} strokeWidth={1.8} aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base sm:text-lg font-bold text-foreground">
                {material.title}
              </DialogTitle>
              <div className="pt-0.5">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                  {materialTypeLabel(material.materialType)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Header Action Buttons (Download hidden in compact/unsupported mode to remove redundancy) */}
          {(onEdit || isSupported) && (
            <div className="flex shrink-0 items-center gap-2">
              {onEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium"
                  onClick={() => {
                    onClose();
                    onEdit(material);
                  }}
                >
                  <IconPencil size={14} aria-hidden="true" />
                  <span>Edit</span>
                </Button>
              )}

              {isSupported && (
                <Button asChild size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-xs">
                  <a href={fileUrl} download={material.fileName}>
                    <IconDownload size={14} aria-hidden="true" />
                    <span>Download</span>
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Content Viewer Workspace */}
        {!isSupported ? (
          /* Clean VS Code style "Preview not available" placeholder */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 py-8 px-6 text-center my-1">
            <div className={cn("flex size-14 items-center justify-center rounded-2xl border shadow-2xs", fileInfo.bg)}>
              <fileInfo.Icon size={30} className={fileInfo.color} strokeWidth={1.8} aria-hidden="true" />
            </div>

            <h4 className="mt-3.5 text-base font-semibold text-foreground">
              Preview not available
            </h4>

            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              This file format (<span className="font-semibold uppercase text-foreground/80">{extension}</span>) cannot be previewed in the browser. Download the file to view it in its default application.
            </p>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <Button asChild size="default" className="gap-2 shadow-xs">
                <a href={fileUrl} download={material.fileName}>
                  <IconDownload size={16} aria-hidden="true" />
                  <span>Download {extension} File</span>
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl">
            {category === "pdf" ? (
              <CustomPdfViewer
                url={inlineUrl}
                title={material.title}
                downloadUrl={fileUrl}
                className="h-full border border-border/60 rounded-xl"
              />
            ) : category === "image" ? (
              <ZoomableImageViewer
                src={inlineUrl}
                alt={material.title}
                openUrl={inlineUrl}
                fillParent
                className="h-full"
              />
            ) : category === "text" ? (
              <TextFilePreviewer url={inlineUrl} fileName={material.fileName} />
            ) : category === "audio" ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-border/70 bg-card p-8 text-center shadow-xs">
                <div className="flex size-20 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <IconMusic size={36} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">{material.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{material.fileName} ({formatBytes(material.fileSize)})</p>
                <div className="mt-6 w-full max-w-md">
                  <audio controls src={inlineUrl} className="w-full">
                    Your browser does not support the audio player.
                  </audio>
                </div>
              </div>
            ) : category === "video" ? (
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-black">
                <CustomVideoPlayer
                  src={inlineUrl}
                  title={material.title}
                  downloadName={material.fileName}
                  openUrl={inlineUrl}
                  fillParent
                  className="size-full"
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Bottom Details Footer Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            {material.subject && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <IconBook2 size={13} className="text-primary" aria-hidden="true" />
                <span>{material.subject.name}</span>
              </span>
            )}
            {material.program && (
              <span className="hidden sm:inline">
                • {material.program.name} ({material.program.code})
              </span>
            )}
            {material.topic && (
              <span className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px]">
                Topic: {material.topic}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {material.bookmarkCount > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <IconStarFilled size={12} aria-hidden="true" />
                <span>{material.bookmarkCount} saved</span>
              </span>
            )}
            <span>Uploaded {formatDate(material.createdAt)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
