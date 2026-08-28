"use client";

import { useRef, useState, type FormEvent, type ChangeEvent, type DragEvent } from "react";
import { SEMESTERS, formatBytes, type SyllabusMeta } from "@/app/lib/syllabi-shared";
import { IconUpload, IconFileText, IconX } from "@tabler/icons-react";

export type SyllabusSubmitValues = {
  title: string; // optional at submission (trimmed); empty => server derives from file
  departmentName: string;
  programId: string;
  semester: string; // 1..8 as a string from the select
  file: File | null;
};

type Props = {
  mode: "create" | "edit";
  meta: SyllabusMeta;
  initial?: Partial<SyllabusSubmitValues>;
  submitting: boolean;
  error: string;
  onSubmit: (values: SyllabusSubmitValues) => void;
  onCancel: () => void;
};

const emptyValues: SyllabusSubmitValues = {
  title: "",
  departmentName: "",
  programId: "",
  semester: "",
  file: null,
};

export function SyllabusForm({
  mode,
  meta,
  initial,
  submitting,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<SyllabusSubmitValues>({
    ...emptyValues,
    ...(initial ?? {}),
  });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Programs belonging to the currently selected department. Changing the
  // department clears programId in its own onChange, so no sync effect is needed.
  const departmentPrograms = (meta.programs ?? []).filter(
    (p) => p.departmentName === values.departmentName,
  );

  function applyFile(f: File | null) {
    setValues((v) => ({ ...v, file: f }));
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    applyFile(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    applyFile(e.dataTransfer.files?.[0] ?? null);
  }

  function openPicker() {
    if (!submitting) fileRef.current?.click();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!values.departmentName) {
      return;
    }
    if (mode === "create" && !values.file) {
      return;
    }
    onSubmit(values);
  }

  const canSubmit =
    !submitting &&
    !!values.departmentName &&
    !!values.programId &&
    !!values.semester &&
    (mode === "edit" ? true : !!values.file);

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      {error && <p className="notes-form-error">{error}</p>}

      <label htmlFor="syllabus-title">
        Title (optional)
        <input
          id="syllabus-title"
          type="text"
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          placeholder="Leave blank to use the file name"
          disabled={submitting}
        />
      </label>

      <label htmlFor="syllabus-department">
        Department *
        <select
          id="syllabus-department"
          value={values.departmentName}
          onChange={(e) =>
            setValues({ ...values, departmentName: e.target.value, programId: "" })
          }
          disabled={submitting}
        >
          <option value="">Select a department</option>
          {(meta.departments ?? []).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="syllabus-program">
        Program *
        <select
          id="syllabus-program"
          value={values.programId}
          onChange={(e) => setValues({ ...values, programId: e.target.value })}
          disabled={submitting || !values.departmentName}
        >
          <option value="">Select a program</option>
          {departmentPrograms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="syllabus-semester">
        Semester *
        <select
          id="syllabus-semester"
          value={values.semester}
          onChange={(e) => setValues({ ...values, semester: e.target.value })}
          disabled={submitting}
        >
          <option value="">Select a semester</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={String(s)}>
              Semester {s}
            </option>
          ))}
        </select>
      </label>

      {/* PDF dropzone */}
      <div className="notes-field-group">
        <span className="notes-field-caption">
          PDF File {mode === "create" ? "*" : "(leave empty to keep current)"}
        </span>
        <div
          className={`syllabus-dropzone${dragOver ? " drag" : ""}${
            values.file ? " has-file" : ""
          }`}
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            id="syllabus-file"
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={submitting}
            className="syllabus-dropzone-input"
          />
          {values.file ? (
            <>
              <span className="syllabus-dropzone-icon">
                <IconFileText size={26} aria-hidden="true" />
              </span>
              <strong className="syllabus-dropzone-name">{values.file.name}</strong>
              <small className="syllabus-dropzone-hint">
                {formatBytes(values.file.size)} · click or drop to replace
              </small>
              <button
                type="button"
                className="syllabus-dropzone-remove"
                aria-label="Remove selected file"
                title="Remove file"
                onClick={(e) => {
                  e.stopPropagation();
                  applyFile(null);
                }}
                disabled={submitting}
              >
                <IconX size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <span className="syllabus-dropzone-icon">
                <IconUpload size={26} aria-hidden="true" />
              </span>
              <strong className="syllabus-dropzone-name">
                {dragOver ? "Drop the PDF here" : "Drag & drop your PDF here"}
              </strong>
              <small className="syllabus-dropzone-hint">
                or click to browse — PDF only, up to 50 MB
              </small>
            </>
          )}
        </div>
        {mode === "edit" && !values.file && (
          <span className="notes-file-chosen muted" style={{ display: "block" }}>
            No new file selected — the existing PDF will be kept.
          </span>
        )}
      </div>

      <div className="modal-actions">
        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {submitting ? mode === "create" ? "Uploading…" : "Saving…" : mode === "create" ? "Upload Syllabus" : "Save Changes"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
