"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { IconFileText, IconUpload, IconX } from "@tabler/icons-react";
import { formatBytes } from "@/app/lib/syllabi-shared";
import { cn } from "cn";

type FileDropzoneProps = {
  id: string;
  /** input accept attribute, e.g. "application/pdf" or "image/*,application/pdf" */
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  /** Shown while empty and not dragging, e.g. "Drag & drop your PDF here" */
  label?: string;
  /** Shown while dragging a file over the zone, e.g. "Drop the PDF here" */
  dropLabel?: string;
  /** Small helper line, e.g. "or click to browse — PDF only, up to 50 MB" */
  hint: string;
  /** Icon shown while empty (defaults to the upload icon) */
  emptyIcon?: ReactNode;
  /** Icon shown when a file is selected (defaults to the file icon) */
  fileIcon?: ReactNode;
};

export function FileDropzone({
  id,
  accept,
  file,
  onFileChange,
  disabled = false,
  label = "Drag & drop your file here",
  dropLabel = "Drop the file here",
  hint,
  emptyIcon,
  fileIcon,
}: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    onFileChange(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    onFileChange(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
        dragOver ? "border-ring bg-accent/40" : "border-border hover:border-ring/60 hover:bg-muted/30",
        disabled && "cursor-not-allowed opacity-60",
        !disabled && "cursor-pointer"
      )}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
      />
      {file ? (
        <>
          <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {fileIcon ?? <IconFileText size={26} aria-hidden="true" />}
          </span>
          <strong className="max-w-full truncate text-sm font-semibold">{file.name}</strong>
          <small className="text-xs text-muted-foreground">
            {formatBytes(file.size)} · click or drop to replace
          </small>
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Remove selected file"
            title="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
            disabled={disabled}
          >
            <IconX size={14} aria-hidden="true" />
            Remove
          </button>
        </>
      ) : (
        <>
          <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {emptyIcon ?? <IconUpload size={26} aria-hidden="true" />}
          </span>
          <strong className="text-sm font-semibold">{dragOver ? dropLabel : label}</strong>
          <small className="text-xs text-muted-foreground">{hint}</small>
        </>
      )}
    </div>
  );
}
