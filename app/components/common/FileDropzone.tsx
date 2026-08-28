"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { IconFileText, IconUpload, IconX } from "@tabler/icons-react";
import { formatBytes } from "@/app/lib/syllabi-shared";

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

/**
 * Shared professional upload/dropzone input: accent dashed border,
 * drag-and-drop + hover state, and a selected-file state with a remove
 * action. Backed by the `syllabus-dropzone` styles in globals.css.
 */
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
      className={`syllabus-dropzone${dragOver ? " drag" : ""}${file ? " has-file" : ""}`}
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
        className="syllabus-dropzone-input"
      />
      {file ? (
        <>
          <span className="syllabus-dropzone-icon">
            {fileIcon ?? <IconFileText size={26} aria-hidden="true" />}
          </span>
          <strong className="syllabus-dropzone-name">{file.name}</strong>
          <small className="syllabus-dropzone-hint">
            {formatBytes(file.size)} · click or drop to replace
          </small>
          <button
            type="button"
            className="syllabus-dropzone-remove"
            aria-label="Remove selected file"
            title="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
            disabled={disabled}
          >
            <IconX size={16} aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <span className="syllabus-dropzone-icon">
            {emptyIcon ?? <IconUpload size={26} aria-hidden="true" />}
          </span>
          <strong className="syllabus-dropzone-name">
            {dragOver ? dropLabel : label}
          </strong>
          <small className="syllabus-dropzone-hint">{hint}</small>
        </>
      )}
    </div>
  );
}