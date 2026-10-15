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
  /** Shown while empty and not dragging */
  label?: string;
  /** Shown while dragging a file over the zone */
  dropLabel?: string;
  /** Small helper line */
  hint?: string;
  /** Icon shown while empty (defaults to the upload icon) */
  emptyIcon?: ReactNode;
  /** Icon shown when a file is selected (defaults to the file icon) */
  fileIcon?: ReactNode;
  className?: string;
};

export function FileDropzone({
  id,
  accept,
  file,
  onFileChange,
  disabled = false,
  label = "Upload file or drag & drop",
  dropLabel = "Drop file here",
  hint,
  emptyIcon,
  fileIcon,
  className,
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
        "relative flex w-full min-w-0 max-w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors",
        dragOver ? "border-ring bg-accent/40" : "border-border hover:border-ring/60 hover:bg-muted/30",
        disabled && "cursor-not-allowed opacity-60",
        !disabled && "cursor-pointer",
        className
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
        <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-1 px-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {fileIcon ?? <IconFileText size={20} aria-hidden="true" />}
          </span>
          <div className="w-full min-w-0 max-w-full overflow-hidden text-center">
            <strong
              className="block w-full min-w-0 truncate text-sm font-semibold text-foreground"
              title={file.name}
            >
              {file.name}
            </strong>
          </div>
          <small className="text-xs text-muted-foreground">
            {formatBytes(file.size)}
          </small>
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label="Remove selected file"
            title="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
            disabled={disabled}
          >
            <IconX size={13} aria-hidden="true" />
            Remove
          </button>
        </div>
      ) : (
        <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-1 px-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {emptyIcon ?? <IconUpload size={20} aria-hidden="true" />}
          </span>
          <strong className="block w-full min-w-0 truncate text-xs font-medium text-foreground">
            {dragOver ? dropLabel : label}
          </strong>
          {hint && <small className="text-[11px] text-muted-foreground max-w-xs">{hint}</small>}
        </div>
      )}
    </div>
  );
}
