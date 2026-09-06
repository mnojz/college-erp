"use client";

import { useState, type DragEvent } from "react";
import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { SEMESTERS } from "@/app/lib/syllabi-shared";
import type { SyllabusDto } from "@/app/lib/syllabi-shared";
import type { ProgramGroup } from "./SyllabusGroupedList";
import { SyllabusAdminRow } from "./SyllabusAdminRow";
import { SyllabusPublicRow } from "./SyllabusPublicRow";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";

type Syllabus = SyllabusDto;

interface Props {
  groups: ProgramGroup[];
  variant: "admin" | "public";
  onEdit?: (s: Syllabus) => void;
  onDelete?: (s: Syllabus) => void;
  /** Admin only: an empty semester slot was activated (click) or a file dropped onto it. */
  onAdd?: (programId: string | null, semester: number, file?: File) => void;
  /** Admin only: the empty slot currently receiving a direct drop-upload (shows a spinner). */
  uploading?: { programId: string | null; semester: number } | null;
}

/**
 * Shared syllabus library renderer for admins, students and guest users.
 * Renders one shadcn Card per PROGRAM (Computer, Civil, Architecture, …) with
 * a responsive grid of 8 semester slots. Each slot is a single flat box —
 * files are listed straight on the slot (no nested boxes); empty slots show
 * a centered placeholder, or an "Add syllabus" dropzone in admin mode.
 */
export function SyllabusProgramSections({
  groups,
  variant,
  onEdit,
  onDelete,
  onAdd,
  uploading,
}: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const totalFiles = SEMESTERS.reduce(
          (n, sem) => n + (group.bySemester.get(sem)?.length ?? 0),
          0,
        );
        return (
          <Card key={group.key} className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {group.program ? (
                  <>
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                      {group.program.code}
                    </span>
                    <span>{group.program.name}</span>
                  </>
                ) : (
                  "Unassigned"
                )}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {group.program && (
                  <CardDescription>{group.program.departmentName}</CardDescription>
                )}
                <Badge variant="secondary" className="ml-auto">
                  {totalFiles} {totalFiles === 1 ? "file" : "files"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SEMESTERS.map((sem) => (
                <SemesterSlot
                  key={sem}
                  semester={sem}
                  items={group.bySemester.get(sem) ?? []}
                  programId={group.program?.id ?? null}
                  variant={variant}
                  onAdd={onAdd}
                  uploading={uploading}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface SlotProps {
  semester: number;
  items: Syllabus[];
  programId: string | null;
  variant: "admin" | "public";
  onAdd?: Props["onAdd"];
  uploading?: Props["uploading"];
  onEdit?: Props["onEdit"];
  onDelete?: Props["onDelete"];
}

/** One flat semester box: header row + a body of file rows, dropzone, or placeholder. */
function SemesterSlot({
  semester,
  items,
  programId,
  variant,
  onAdd,
  uploading,
  onEdit,
  onDelete,
}: SlotProps) {
  const [dragOver, setDragOver] = useState(false);

  const uploadingHere =
    !!uploading &&
    uploading.semester === semester &&
    (uploading.programId ?? null) === (programId ?? null);

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    onAdd?.(programId, semester, file ?? undefined);
  }

  let body: React.ReactNode;
  if (uploadingHere) {
    body = (
      <div
        className="flex min-h-20 flex-1 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-ring/60 bg-accent/30 text-center"
        aria-live="polite"
      >
        <IconLoader2 size={20} className="animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium">Uploading…</span>
      </div>
    );
  } else if (items.length === 0) {
    if (variant === "admin") {
      body = (
        <button
          type="button"
          onClick={() => onAdd?.(programId, semester)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex min-h-20 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-center transition-colors",
            dragOver
              ? "border-ring bg-accent/40"
              : "border-border hover:border-ring/60 hover:bg-muted/30",
          )}
          aria-label={`Add syllabus for Semester ${semester}`}
        >
          <IconPlus size={20} className="text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-medium">Add syllabus</span>
          <span className="text-[11px] text-muted-foreground">Click or drop a PDF</span>
        </button>
      );
    } else {
      body = (
        <p className="flex min-h-20 flex-1 items-center justify-center text-xs text-muted-foreground/70">
          No syllabus
        </p>
      );
    }
  } else {
    body = (
      <div className="flex flex-col divide-y">
        {items.map((s) =>
          variant === "admin" ? (
            <SyllabusAdminRow
              key={s.id}
              syllabus={s}
              onEdit={() => onEdit?.(s)}
              onDelete={() => onDelete?.(s)}
            />
          ) : (
            <SyllabusPublicRow key={s.id} syllabus={s} />
          ),
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-lg border bg-muted/40 px-3 pb-2 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Semester {semester}</span>
        {items.length > 1 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {items.length}
          </Badge>
        )}
      </div>
      {body}
    </div>
  );
}