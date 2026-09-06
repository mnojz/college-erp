"use client";

import { useState, type FormEvent } from "react";
import { SEMESTERS, type SyllabusMeta } from "@/app/lib/syllabi-shared";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/app/components/common/FileDropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SyllabusSubmitValues = {
  title: string; // optional at submission (trimmed); empty => server derives from file
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

  const programs = meta.programs ?? [];

  function applyFile(f: File | null) {
    setValues((v) => ({ ...v, file: f }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (mode === "create" && !values.file) {
      return;
    }
    onSubmit(values);
  }

  const canSubmit =
    !submitting &&
    !!values.programId &&
    !!values.semester &&
    (mode === "edit" ? true : !!values.file);

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="syllabus-program">Program *</Label>
          <Select
            value={values.programId || undefined}
            onValueChange={(value) => setValues({ ...values, programId: value })}
            disabled={submitting || programs.length === 0}
          >
            <SelectTrigger id="syllabus-program" aria-label="Program" className="w-full">
              <SelectValue placeholder="Select a program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="syllabus-semester">Semester *</Label>
          <Select
            value={values.semester || undefined}
            onValueChange={(value) => setValues({ ...values, semester: value })}
            disabled={submitting}
          >
            <SelectTrigger id="syllabus-semester" aria-label="Semester" className="w-full">
              <SelectValue placeholder="Select a semester" />
            </SelectTrigger>
            <SelectContent>
              {SEMESTERS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  Semester {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          PDF File {mode === "create" ? "*" : "(leave empty to keep current)"}
        </span>
        <FileDropzone
          id="syllabus-file"
          accept="application/pdf"
          file={values.file}
          onFileChange={applyFile}
          disabled={submitting}
          label="Drag & drop your PDF here"
          dropLabel="Drop the PDF here"
          hint="or click to browse — PDF only, up to 50 MB"
        />
        {mode === "edit" && !values.file && (
          <span className="text-xs text-muted-foreground">
            No new file selected — the existing PDF will be kept.
          </span>
        )}
      </div>

      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting
            ? mode === "create"
              ? "Uploading…"
              : "Saving…"
            : mode === "create"
              ? "Upload Syllabus"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
