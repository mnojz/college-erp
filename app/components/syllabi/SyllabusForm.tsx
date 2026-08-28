"use client";

import { useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { SEMESTERS, type SyllabusMeta } from "@/app/lib/syllabi-shared";

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
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Programs belonging to the currently selected department. Changing the
  // department clears programId in its own onChange, so no sync effect is needed.
  const departmentPrograms = (meta.programs ?? []).filter(
    (p) => p.departmentName === values.departmentName,
  );

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setValues((v) => ({ ...v, file: f }));
    setFileName(f?.name ?? null);
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

      <label htmlFor="syllabus-file">
        PDF File {mode === "create" ? "*" : "(leave empty to keep current)"}
        <input
          id="syllabus-file"
          ref={fileRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={submitting}
          className="notes-file-input"
        />
        {fileName && (
          <span className="notes-file-chosen" style={{ display: "block" }}>
            {fileName}
          </span>
        )}
        {mode === "edit" && !fileName && (
          <span className="notes-file-chosen muted" style={{ display: "block" }}>
            No new file selected — the existing PDF will be kept.
          </span>
        )}
      </label>

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
