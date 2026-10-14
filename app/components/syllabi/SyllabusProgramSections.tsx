"use client";

import { useRef, useState, type DragEvent } from "react";
import { IconCloudUpload, IconLoader2 } from "@tabler/icons-react";
import { SEMESTERS } from "@/app/lib/syllabi-shared";
import type { SyllabusDto } from "@/app/lib/syllabi-shared";
import type { ProgramGroup } from "./SyllabusGroupedList";
import { SyllabusAdminRow } from "./SyllabusAdminRow";
import { SyllabusPublicRow } from "./SyllabusPublicRow";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";

type Syllabus = SyllabusDto;

interface Props {
  groups: ProgramGroup[];
  variant: "admin" | "public";
  onPreview?: (s: Syllabus) => void;
  onEdit?: (s: Syllabus) => void;
  onDelete?: (s: Syllabus) => void;
  /** Admin only: directly upload a selected or dropped file to this semester slot. */
  onUpload?: (programId: string | null, semester: number, file: File) => void;
  /** Admin only: the slot currently receiving a direct upload (shows spinner). */
  uploading?: { programId: string | null; semester: number } | null;
}

/**
 * Clean, distraction-free syllabus program sections.
 * Displays program cards with simple headers and an 8-semester slot grid.
 */
export function SyllabusProgramSections({
  groups,
  variant,
  onPreview,
  onEdit,
  onDelete,
  onUpload,
  uploading,
}: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <Card key={group.key} className="overflow-hidden border border-border/70 shadow-xs">
          {/* Program Header - clean program name without code avatar or progress bars */}
          <CardHeader className="border-b bg-muted/20 px-5 py-3.5">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                {group.program ? group.program.name : "Unassigned Syllabi"}
              </CardTitle>
              {group.program?.departmentName && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {group.program.departmentName}
                </p>
              )}
            </div>
          </CardHeader>

          {/* 8-Semester Grid */}
          <CardContent className="grid grid-cols-1 gap-4 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-4 bg-muted/5">
            {SEMESTERS.map((sem) => (
              <SemesterSlot
                key={sem}
                semester={sem}
                items={group.bySemester.get(sem) ?? []}
                programId={group.program?.id ?? null}
                variant={variant}
                onUpload={onUpload}
                uploading={uploading}
                onPreview={onPreview}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SlotProps {
  semester: number;
  items: Syllabus[];
  programId: string | null;
  variant: "admin" | "public";
  onUpload?: Props["onUpload"];
  uploading?: Props["uploading"];
  onPreview?: Props["onPreview"];
  onEdit?: Props["onEdit"];
  onDelete?: Props["onDelete"];
}

/** One semester slot: clean header without active badges, and direct click-to-upload or dropped files */
function SemesterSlot({
  semester,
  items,
  programId,
  variant,
  onUpload,
  uploading,
  onPreview,
  onEdit,
  onDelete,
}: SlotProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadingHere =
    !!uploading &&
    uploading.semester === semester &&
    (uploading.programId ?? null) === (programId ?? null);

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload?.(programId, semester, file);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUpload?.(programId, semester, file);
    }
    // Clear value so the same file can be selected again if needed
    e.target.value = "";
  }

  let body: React.ReactNode;
  if (uploadingHere) {
    body = (
      <div
        className="flex min-h-28 flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 text-center p-4 animate-pulse"
        aria-live="polite"
      >
        <IconLoader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold text-primary">Uploading PDF…</span>
        <span className="text-xs text-muted-foreground">Registering syllabus</span>
      </div>
    );
  } else if (items.length === 0) {
    if (variant === "admin") {
      body = (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "group flex min-h-28 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center transition-all p-4",
              dragOver
                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                : "border-border/80 bg-background/50 hover:border-primary/60 hover:bg-card hover:shadow-2xs",
            )}
            aria-label={`Upload syllabus for Semester ${semester}`}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <IconCloudUpload size={20} aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-foreground group-hover:text-primary">
              Upload Syllabus
            </span>
            <span className="text-xs text-muted-foreground">Click or drop PDF here</span>
          </button>
        </>
      );
    } else {
      body = (
        <div className="flex min-h-28 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 bg-muted/20 text-center p-4">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Not published yet</span>
          <span className="text-xs text-muted-foreground/70">Check back later</span>
        </div>
      );
    }
  } else {
    body = (
      <div className="flex flex-col gap-2">
        {items.map((s) =>
          variant === "admin" ? (
            <SyllabusAdminRow
              key={s.id}
              syllabus={s}
              onPreview={() => onPreview?.(s)}
              onEdit={() => onEdit?.(s)}
              onDelete={() => onDelete?.(s)}
            />
          ) : (
            <SyllabusPublicRow
              key={s.id}
              syllabus={s}
              onPreview={() => onPreview?.(s)}
            />
          ),
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-3.5 transition-colors",
        items.length > 0
          ? "border-border/80 bg-card/60 shadow-2xs"
          : "border-dashed border-border/70 bg-card/30",
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs sm:text-sm font-bold text-foreground">Semester {semester}</span>
      </div>
      {body}
    </div>
  );
}