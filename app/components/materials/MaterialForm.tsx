"use client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useMemo, useState } from "react";
import {
  MATERIAL_TYPES,
  VISIBILITY_OPTIONS,
  semestersForDuration,
  type ProgramsMeta,
} from "@/app/lib/materials-shared";
import { cn } from "cn";

/** Radix Select forbids empty-string values, so "not specific" uses a sentinel. */
const NONE = "NONE";

/** Compact labels for the inline visibility radio row (full text is in the tooltip). */
const VISIBILITY_SHORT: Record<string, string> = {
  EVERYONE: "Everyone",
  DEPARTMENT_PROGRAM: "Program",
  CLASSES: "Classes",
};

export type MaterialSubmitValues = {
  title: string;
  description: string;
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
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-1.5">
        <Label htmlFor="material-title">Title *</Label>
        <Input
          id="material-title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Unit 4 — Sequential Circuits Notes"
          required
          maxLength={200}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="material-description">Description</Label>
        <Textarea
          id="material-description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="What does this material cover?"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="material-type">Material Type *</Label>
          <Select value={values.materialType} onValueChange={(v) => set("materialType", v)}>
            <SelectTrigger id="material-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="material-program">Program</Label>
          <Select
            value={values.programId || NONE}
            onValueChange={(v) => handleProgramChange(v === NONE ? "" : v)}
          >
            <SelectTrigger id="material-program" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not specific</SelectItem>
              {meta.programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="material-semester">Semester</Label>
          <Select
            value={values.semester || NONE}
            onValueChange={(v) =>
              setValues((prev) => ({
                ...prev,
                semester: v === NONE ? "" : v,
                subjectId: "",
              }))
            }
            disabled={semesterOptions.length === 0}
          >
            <SelectTrigger id="material-semester" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not specific</SelectItem>
              {semesterOptions.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  Semester {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="material-subject">Subject</Label>
          <Select
            value={values.subjectId || NONE}
            onValueChange={(v) => handleSubjectChange(v === NONE ? "" : v)}
          >
            <SelectTrigger id="material-subject" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>General / Not subject-specific</SelectItem>
              {filteredSubjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="material-visibility">Visibility *</Label>
        <div className="grid grid-cols-3 gap-2" id="material-visibility">
          {VISIBILITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              title={opt.hint}
              className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-[12.5px] font-medium transition-colors hover:border-primary/50 has-checked:border-primary has-checked:bg-primary/10 has-checked:font-semibold"
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={values.visibility === opt.value}
                onChange={() => set("visibility", opt.value)}
                aria-label={opt.label}
                className="size-3.5 shrink-0 accent-primary"
              />
              <span className="truncate">{VISIBILITY_SHORT[opt.value] ?? opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {values.visibility === "CLASSES" && (
        <div className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Select classes *
          </span>
          {classGroups.length === 0 ? (
            <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">
              No teaching groups found. Add classes to your schedule first to target them here.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
              {classGroups.map((g) => {
                const selected =
                  g.classIds.length > 0 &&
                  g.classIds.every((id) => values.selectedClassIds.includes(id));
                return (
                  <label
                    key={g.key}
                    onClick={() => toggleClass(g.key)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5 text-[12.5px] font-semibold transition-colors",
                      "hover:border-[color-mix(in_oklab,var(--ctp-sky)_55%,transparent)]",
                      selected &&
                        "border-[var(--ctp-sky)] bg-[color-mix(in_oklab,var(--ctp-sky)_12%,transparent)]",
                    )}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleClass(g.key)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={g.label}
                    />
                    <span>{g.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="material-file">
          File *
          {mode === "edit" && (
            <span className="ml-1 font-medium text-muted-foreground normal-case">
              (leave empty to keep current file)
            </span>
          )}
        </Label>
        <input
          id="material-file"
          type="file"
          className="w-full cursor-pointer rounded-lg border border-dashed border-input bg-transparent px-3 py-2.5 text-[13px] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.jpg,.jpeg,.png,.gif,.webp"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
            setFileName(selected?.name ?? "");
          }}
          required={mode === "create"}
          disabled={submitting}
        />
        {fileName && (
          <span className="mt-1.5 inline-block text-xs font-semibold text-primary">
            Selected: {fileName}
          </span>
        )}
        {!fileName && mode === "edit" && (
          <span className="mt-1.5 inline-block text-xs font-medium text-muted-foreground">
            Keeping the existing file.
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-[13px] font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2.5">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? mode === "create"
              ? "Uploading…"
              : "Saving…"
            : mode === "create"
              ? "Upload Material"
              : "Save Changes"}
        </Button>
        <Button variant="outline" type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}


