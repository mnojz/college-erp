"use client";

import { useMemo, useState } from "react";
import {
  MATERIAL_TYPES,
  VISIBILITY_OPTIONS,
  semestersForDuration,
  type ProgramsMeta,
} from "@/app/lib/materials-shared";

export type MaterialSubmitValues = {
  title: string;
  description: string;
  topic: string;
  materialType: string;
  visibility: string;
  departmentName: string;
  programId: string;
  semester: string;
  subjectId: string;
  classIds: string[];
  file: File | null;
};

export type MaterialFormInitial = Partial<{
  title: string;
  description: string | null;
  topic: string | null;
  materialType: string;
  visibility: string;
  departmentName: string | null;
  programId: string | null;
  semester: number | null;
  subjectId: string | null;
  classIds: string[];
}>;

type ClassGroup = { key: string; label: string; classIds: string[] };

type MaterialFormProps = {
  mode: "create" | "edit";
  initial?: MaterialFormInitial;
  meta: ProgramsMeta;
  classGroups: ClassGroup[];
  submitting: boolean;
  error: string;
  onSubmit: (values: MaterialSubmitValues) => void;
  onCancel: () => void;
};

const DEFAULT_VALUES = {
  title: "",
  description: "",
  topic: "",
  materialType: "LECTURE_NOTES",
  visibility: "EVERYONE",
  departmentName: "",
  programId: "",
  semester: "",
  subjectId: "",
};

/**
 * Shared study-material metadata form used inside the teacher's
 * Upload/Edit modals. Department → Program → Subject cascade so academic
 * metadata stays consistent; every field except Title/Type/File/Visibility is
 * intentionally optional so materials are not forced into a single class.
 */
export function MaterialForm({
  mode,
  initial,
  meta,
  classGroups,
  submitting,
  error,
  onSubmit,
  onCancel,
}: MaterialFormProps) {
  const [values, setValues] = useState(() => ({
    ...DEFAULT_VALUES,
    ...(initial ?? {}),
    description: initial?.description ?? "",
    topic: initial?.topic ?? "",
    departmentName: initial?.departmentName ?? "",
    programId: initial?.programId ?? "",
    semester: initial?.semester != null ? String(initial.semester) : "",
    subjectId: initial?.subjectId ?? "",
    selectedClassIds: initial?.classIds ?? [],
  }));
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const selectedProgram = meta.programs.find((p) => p.id === values.programId);
  const semesterOptions = useMemo(
    () => (selectedProgram ? semestersForDuration(selectedProgram.durationYears) : []),
    [selectedProgram],
  );

  const filteredSubjects = useMemo(
    () =>
      meta.subjects.filter(
        (s) =>
          (!values.programId || s.programId === values.programId) &&
          (!values.semester || s.semester === Number(values.semester)),
      ),
    [meta.subjects, values.programId, values.semester],
  );

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleProgramChange(programId: string) {
    setValues((v) => ({ ...v, programId, semester: "", subjectId: "" }));
  }

  function handleSubjectChange(subjectId: string) {
    setValues((v) => {
      if (!subjectId) return { ...v, subjectId };
      const subject = meta.subjects.find((s) => s.id === subjectId);
      if (!subject) return { ...v, subjectId };
      return {
        ...v,
        subjectId,
        departmentName:
          v.departmentName ||
          meta.programs.find((p) => p.id === subject.programId)?.departmentName ||
          "",
        programId: subject.programId,
        semester: String(subject.semester),
      };
    });
  }

  function toggleClass(key: string) {
    setValues((v) => {
      const group = classGroups.find((g) => g.key === key);
      if (!group) return v;
      const allSelected = group.classIds.every((id) => v.selectedClassIds.includes(id));
      return {
        ...v,
        selectedClassIds: allSelected
          ? v.selectedClassIds.filter((id) => !group.classIds.includes(id))
          : [...new Set([...v.selectedClassIds, ...group.classIds])],
      };
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      topic: values.topic.trim(),
      materialType: values.materialType,
      visibility: values.visibility,
      departmentName: values.departmentName,
      programId: values.programId,
      semester: values.semester,
      subjectId: values.subjectId,
      classIds: values.selectedClassIds,
      file,
    });
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <label>
        Title *
        <input
          type="text"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Unit 4 — Sequential Circuits Notes"
          required
          maxLength={200}
        />
      </label>

      <label>
        Description
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="What does this material cover?"
        />
      </label>

      <div className="inline-pair">
        <label>
          Material Type *
          <select value={values.materialType} onChange={(e) => set("materialType", e.target.value)} required>
            {MATERIAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Topic
          <input
            type="text"
            value={values.topic}
            onChange={(e) => set("topic", e.target.value)}
            placeholder="e.g. Operating Systems"
          />
        </label>
      </div>

      <div className="inline-pair">
        <label>
          Program
          <select value={values.programId} onChange={(e) => handleProgramChange(e.target.value)}>
            <option value="">Not specific</option>
            {meta.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="inline-pair">
        <label>
          Semester
          <select
            value={values.semester}
            onChange={(e) => setValues((v) => ({ ...v, semester: e.target.value, subjectId: "" }))}
            disabled={semesterOptions.length === 0}
          >
            <option value="">Not specific</option>
            {semesterOptions.map((s) => (
              <option key={s} value={String(s)}>
                Semester {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          Subject
          <select value={values.subjectId} onChange={(e) => handleSubjectChange(e.target.value)}>
            <option value="">General / Not subject-specific</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="notes-visibility-group">
        <span className="notes-field-caption">Visibility *</span>
        <div className="notes-visibility-options">
          {VISIBILITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`notes-visibility-option${values.visibility === opt.value ? " selected" : ""}`}
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={values.visibility === opt.value}
                onChange={() => set("visibility", opt.value)}
              />
              <span>
                <strong>{opt.label}</strong>
                <small>{opt.hint}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      {values.visibility === "CLASSES" && (
        <div className="notes-class-picker">
          <span className="notes-field-caption">Select classes *</span>
          {classGroups.length === 0 ? (
            <p className="notes-hint-text">
              No teaching groups found. Add classes to your schedule first to target them here.
            </p>
          ) : (
            <div className="notes-class-grid">
              {classGroups.map((g) => {
                const selected =
                  g.classIds.length > 0 && g.classIds.every((id) => values.selectedClassIds.includes(id));
                return (
                  <label key={g.key} className={`notes-class-option${selected ? " selected" : ""}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleClass(g.key)} />
                    <span>{g.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <label>
        File *{" "}
        {mode === "edit" && (
          <small style={{ textTransform: "none", fontWeight: 500 }}>
            (leave empty to keep current file)
          </small>
        )}
        <input
          type="file"
          className="notes-file-input"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.jpg,.jpeg,.png,.gif,.webp"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
            setFileName(selected?.name ?? "");
          }}
          required={mode === "create"}
          disabled={submitting}
        />
        {fileName && <span className="notes-file-chosen">Selected: {fileName}</span>}
        {!fileName && mode === "edit" && (
          <span className="notes-file-chosen muted">Keeping the existing file.</span>
        )}
      </label>

      {error && <p className="notes-form-error">{error}</p>}

      <div className="modal-actions">
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting
            ? mode === "create"
              ? "Uploading…"
              : "Saving…"
            : mode === "create"
              ? "Upload Material"
              : "Save Changes"}
        </button>
        <button className="btn-ghost" type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}


