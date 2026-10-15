"use client";

import { useMemo, useState } from "react";
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
import { FileDropzone } from "@/app/components/common/FileDropzone";
import {
  MATERIAL_TYPES,
  MAX_FILE_BYTES,
  VISIBILITY_OPTIONS,
  type ProgramsMeta,
} from "@/app/lib/materials-shared";
import { getFileIconInfo } from "@/app/components/materials/material-file-icon";
import {
  IconAlertTriangle,
  IconBook2,
  IconBooks,
  IconBuilding,
  IconFileText,
  IconFlask,
  IconHelpCircle,
  IconLock,
  IconPresentation,
  IconUpload,
  IconWorld,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/** Radix Select forbids empty-string values, so "not specific" uses a sentinel. */
const NONE = "NONE";

export type AssignedSubject = {
  id: string;
  name: string;
  code: string;
  semester: number;
  programId: string;
  programName?: string;
  programCode?: string;
  departmentName?: string;
};

export type MaterialSubmitValues = {
  title: string;
  description?: string;
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
  description?: string | null;
  materialType: string;
  visibility: string;
  departmentName: string | null;
  programId: string | null;
  semester: number | null;
  subjectId: string | null;
  classIds: string[];
  fileName?: string;
}>;

type ClassGroup = { key: string; label: string; classIds: string[]; subjectId?: string };

type MaterialFormProps = {
  mode: "create" | "edit";
  initial?: MaterialFormInitial;
  meta: ProgramsMeta;
  assignedSubjects?: AssignedSubject[];
  classGroups: ClassGroup[];
  submitting: boolean;
  error: string;
  onSubmit: (values: MaterialSubmitValues) => void;
  onCancel: () => void;
};

const DEFAULT_VALUES = {
  title: "",
  materialType: "LECTURE_NOTES",
  visibility: "EVERYONE",
  departmentName: "",
  programId: "",
  semester: "",
  subjectId: "",
};

function typeIcon(type: string) {
  switch (type) {
    case "SLIDES":
      return IconPresentation;
    case "QUESTION_BANK":
      return IconHelpCircle;
    case "PAST_PAPER":
      return IconBooks;
    case "LAB_MANUAL":
      return IconFlask;
    case "ASSIGNMENT":
    case "REFERENCE_MATERIAL":
      return IconBook2;
    default:
      return IconFileText;
  }
}

export function MaterialForm({
  mode,
  initial,
  meta,
  assignedSubjects,
  classGroups,
  submitting,
  error,
  onSubmit,
  onCancel,
}: MaterialFormProps) {
  const [values, setValues] = useState(() => ({
    ...DEFAULT_VALUES,
    ...(initial ?? {}),
    departmentName: initial?.departmentName ?? "",
    programId: initial?.programId ?? "",
    semester: initial?.semester != null ? String(initial.semester) : "",
    subjectId: initial?.subjectId ?? "",
    selectedClassIds: initial?.classIds ?? [],
  }));
  const [file, setFile] = useState<File | null>(null);

  /**
   * Only list subjects assigned to this teacher!
   * Fallback to meta.subjects if no assigned subjects exist on the teacher profile.
   */
  const displayedSubjects = useMemo(() => {
    if (assignedSubjects && assignedSubjects.length > 0) {
      let list = assignedSubjects;
      // Preserve previously saved subject in edit mode if it's not already in list
      if (initial?.subjectId && !list.some((s) => s.id === initial.subjectId)) {
        const prev = meta.subjects.find((s) => s.id === initial.subjectId);
        if (prev) {
          const prog = meta.programs.find((p) => p.id === prev.programId);
          list = [
            ...list,
            {
              id: prev.id,
              name: prev.name,
              code: prev.code,
              semester: prev.semester,
              programId: prev.programId,
              programName: prog?.name,
              programCode: prog?.code,
              departmentName: prog?.departmentName,
            },
          ];
        }
      }
      return list;
    }

    return meta.subjects.map((s) => {
      const prog = meta.programs.find((p) => p.id === s.programId);
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        semester: s.semester,
        programId: s.programId,
        programName: prog?.name,
        programCode: prog?.code,
        departmentName: prog?.departmentName,
      };
    });
  }, [assignedSubjects, meta.subjects, meta.programs, initial?.subjectId]);

  const currentSubject = useMemo(
    () => displayedSubjects.find((s) => s.id === values.subjectId),
    [displayedSubjects, values.subjectId]
  );

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubjectChange(subjectId: string) {
    if (!subjectId || subjectId === NONE) {
      setValues((v) => ({
        ...v,
        subjectId: "",
        programId: "",
        semester: "",
        departmentName: "",
      }));
      return;
    }

    const found = displayedSubjects.find((s) => s.id === subjectId);
    if (found) {
      setValues((v) => ({
        ...v,
        subjectId: found.id,
        programId: found.programId || "",
        departmentName: found.departmentName || "",
        semester: found.semester ? String(found.semester) : "",
      }));
    }
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

  function toggleAllClasses() {
    setValues((v) => {
      const allIds = classGroups.flatMap((g) => g.classIds);
      const allSelected = allIds.length > 0 && allIds.every((id) => v.selectedClassIds.includes(id));
      return {
        ...v,
        selectedClassIds: allSelected ? [] : [...new Set(allIds)],
      };
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit({
      title: values.title.trim(),
      description: "",
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
    <form className="flex flex-col gap-5 text-sm" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Column: Title and Dropdowns (Equal width) */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-title" className="text-xs font-semibold text-foreground">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="material-title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Title"
              required
              maxLength={200}
              className="w-full h-9.5 text-xs rounded-lg"
              autoFocus
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-type" className="text-xs font-semibold text-foreground">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select value={values.materialType} onValueChange={(v) => set("materialType", v)}>
              <SelectTrigger id="material-type" className="w-full h-9.5 text-xs rounded-lg">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map((t) => {
                  const Icon = typeIcon(t.value);
                  return (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      <span className="flex items-center gap-2">
                        <Icon size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
                        <span>{t.label}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Dropdown */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-subject" className="text-xs font-semibold text-foreground">
              Subject
            </Label>
            <Select
              value={values.subjectId || NONE}
              onValueChange={(v) => handleSubjectChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="material-subject" className="w-full h-9.5 text-xs rounded-lg">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-xs text-muted-foreground">
                  General / No Subject
                </SelectItem>
                {displayedSubjects.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span className="truncate">
                      {s.code} — {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Auto-detected Program & Semester indicator */}
            {currentSubject && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/70 bg-muted/30 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {currentSubject.programCode || currentSubject.programName}
                </span>
                <span>•</span>
                <span>Semester {currentSubject.semester}</span>
                {currentSubject.departmentName && (
                  <>
                    <span>•</span>
                    <span className="truncate">{currentSubject.departmentName}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visibility & Upload Section */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Visibility Segmented Buttons */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-foreground">Visibility</Label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map((opt) => {
                const isSelected = values.visibility === opt.value;
                const Icon =
                  opt.value === "EVERYONE"
                    ? IconWorld
                    : opt.value === "DEPARTMENT_PROGRAM"
                    ? IconBuilding
                    : IconLock;

                const shortLabel =
                  opt.value === "EVERYONE"
                    ? "Everyone"
                    : opt.value === "DEPARTMENT_PROGRAM"
                    ? "Program"
                    : "Classes";

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("visibility", opt.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
                        : "border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon size={14} className="shrink-0" aria-hidden="true" />
                    <span>{shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Target Classes Selection if CLASSES is selected */}
            {values.visibility === "CLASSES" && (
              <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-2.5 max-h-36 overflow-y-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    {values.selectedClassIds.length} class{values.selectedClassIds.length === 1 ? "" : "es"} selected
                  </span>
                  {classGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={toggleAllClasses}
                      className="text-primary hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      {classGroups.flatMap((g) => g.classIds).every((id) => values.selectedClassIds.includes(id))
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                  )}
                </div>

                {classGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No classes available.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {classGroups.map((g) => {
                      const selected =
                        g.classIds.length > 0 &&
                        g.classIds.every((id) => values.selectedClassIds.includes(id));
                      return (
                        <label
                          key={g.key}
                          onClick={() => toggleClass(g.key)}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors",
                            selected
                              ? "border-primary bg-primary/10 text-foreground font-semibold"
                              : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleClass(g.key)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="truncate">{g.label}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File Upload Zone */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-foreground">
              File {mode === "create" && <span className="text-destructive">*</span>}
            </Label>
            {mode === "edit" && initial?.fileName && !file && (() => {
              const currentIconInfo = getFileIconInfo(initial.fileName);
              const CurrentIcon = currentIconInfo.Icon;
              return (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/70 bg-muted/30 text-xs text-muted-foreground min-w-0">
                  <CurrentIcon size={14} className={cn("shrink-0", currentIconInfo.color)} aria-hidden="true" />
                  <span className="truncate font-medium" title={initial.fileName}>
                    Current: {initial.fileName}
                  </span>
                </div>
              );
            })()}
            {(() => {
              const fileIconInfo = file ? getFileIconInfo(file.name) : null;
              return (
                <FileDropzone
                  id="material-file-dropzone"
                  className="flex-1 min-h-[120px]"
                  file={file}
                  onFileChange={setFile}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.mkv,.avi,.wmv,.m4v,.ogv,video/*,image/*"
                  label="Upload file or drag & drop"
                  dropLabel="Drop file here"
                  hint={`PDF, Office, Video, Images, Archives (up to ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB)`}
                  disabled={submitting}
                  fileIcon={fileIconInfo ? <fileIconInfo.Icon size={20} className={fileIconInfo.color} aria-hidden="true" /> : undefined}
                />
              );
            })()}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
          <IconAlertTriangle size={15} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-end gap-2.5 border-t border-border/60 pt-3">
        <Button variant="outline" type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="gap-1.5 shadow-xs">
          <IconUpload size={15} aria-hidden="true" />
          <span>
            {submitting
              ? mode === "create"
                ? "Uploading…"
                : "Saving…"
              : mode === "create"
              ? "Upload Material"
              : "Save Changes"}
          </span>
        </Button>
      </div>
    </form>
  );
}
