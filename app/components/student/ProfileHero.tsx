"use client";

import { useState } from "react";
import {
  IconCalendar,
  IconId,
  IconPencil,
  IconSchool,
  IconSparkles,
  IconZoomIn,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProfileImagePreviewModal } from "@/app/components/profile/ProfileImagePreviewModal";

export type ProfileHeroProps = {
  name: string;
  email: string;
  status: string;
  program: string;
  department: string;
  admissionNo: string;
  rollNumber: number | null;
  enrollmentNumber?: string;
  batch?: string;
  semester?: number | null;
  profileImageUrl: string | null;
  reviewStatus?: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  avatarPending?: boolean;
  onEdit?: () => void;
};

function AcademicDoodlePattern() {
  return (
    <div
      className="academic-doodle-pattern absolute inset-0 size-full pointer-events-none select-none bg-repeat opacity-[0.35] dark:opacity-[0.28] transition-opacity"
      style={{
        backgroundImage: "url('/patterns/academic-doodle.png')",
        backgroundSize: "460px auto",
        backgroundPosition: "center",
      }}
      aria-hidden="true"
    />
  );
}

export function ProfileHero({
  name,
  email,
  status,
  program,
  department,
  admissionNo,
  rollNumber,
  enrollmentNumber,
  batch,
  semester,
  profileImageUrl,
  reviewStatus,
  avatarPending,
  onEdit,
}: ProfileHeroProps) {
  const [showImagePreview, setShowImagePreview] = useState(false);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST";

  const active = status.toUpperCase() === "ACTIVE";

  return (
    <>
      <Card className="overflow-hidden border border-border/70 shadow-sm rounded-2xl bg-card p-0 py-0 pt-0 gap-0 [--card-spacing:0px]">
        {/* ── Banner Box with Academic Doodle Pattern ── */}
        <div className="p-3 sm:p-4 pb-0">
          <div className="relative h-28 sm:h-36 w-full rounded-2xl overflow-hidden bg-transparent">
            <AcademicDoodlePattern />
            <div className="absolute right-3 top-3 sm:right-4 sm:top-4 flex items-center gap-2">
              <Badge
                className="border-0 bg-primary/15 text-primary backdrop-blur-md px-2.5 py-1 text-xs font-semibold shadow-xs"
              >
                <IconSparkles size={13} className="text-primary mr-1" />
                {batch || "Undergraduate"}
              </Badge>
            </div>
          </div>
        </div>

        {/* ── Profile Header Info ── */}
        <div className="px-5 pb-5 sm:px-7 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
          {/* Avatar with status ring & click preview */}
          <div className="relative inline-block self-start">
            <button
              type="button"
              onClick={() => setShowImagePreview(true)}
              className="group relative block rounded-2xl cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-transform duration-200 hover:scale-[1.02]"
              title="Click to view full photo"
              aria-label="View enlarged profile photo"
            >
              <Avatar className="size-24 sm:size-28 rounded-2xl ring-4 ring-background shadow-md overflow-hidden">
                {profileImageUrl ? (
                  <AvatarImage
                    src={profileImageUrl}
                    alt={name}
                    className="object-cover rounded-2xl transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
                <AvatarFallback className="rounded-2xl bg-linear-to-br from-primary to-primary/80 text-2xl font-bold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Hover overlay indicator with pointer */}
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white backdrop-blur-[1px]">
                <IconZoomIn className="size-6 drop-shadow-md" aria-hidden="true" />
              </div>
            </button>
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-2 self-start sm:self-end">
            {onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg h-9 font-medium shadow-xs hover:bg-muted/60 transition-colors"
                onClick={onEdit}
              >
                <IconPencil size={15} />
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {/* ── Details Block ── */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{name}</h1>

            {avatarPending && (
              <Badge className="border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                Photo Pending Approval
              </Badge>
            )}
            {reviewStatus === "PENDING_REVIEW" && !avatarPending && (
              <Badge className="border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                Changes Pending Approval
              </Badge>
            )}
            {reviewStatus === "REJECTED" && (
              <Badge className="border-0 bg-rose-500/15 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                Changes Update Required
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-muted-foreground font-medium">
            <span className="inline-flex items-center gap-1.5">
              <IconSchool size={15} className="text-primary/70 shrink-0" />
              {program || "Program not assigned"}
            </span>
            {semester && (
              <>
                <span className="text-muted-foreground/40 hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <IconCalendar size={15} className="text-primary/70 shrink-0" />
                  Semester {semester}
                </span>
              </>
            )}
            {department && (
              <>
                <span className="text-muted-foreground/40 hidden sm:inline">•</span>
                <span className="text-muted-foreground">{department}</span>
              </>
            )}
          </div>

          {/* ── Key Identity Tags ── */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
            {rollNumber != null && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
                <span className="text-muted-foreground font-medium">Roll No:</span>
                <span className="font-mono font-bold text-foreground">#{rollNumber}</span>
              </div>
            )}

            {admissionNo && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
                <IconId size={14} className="text-muted-foreground/80" />
                <span className="text-muted-foreground font-medium">Reg No:</span>
                <span className="font-mono font-semibold text-foreground">{admissionNo}</span>
              </div>
            )}

            {enrollmentNumber && enrollmentNumber !== admissionNo && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
                <span className="text-muted-foreground font-medium">Enrollment:</span>
                <span className="font-mono font-semibold text-foreground">{enrollmentNumber}</span>
              </div>
            )}

            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto md:inline-flex">
              <span>{email}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <ProfileImagePreviewModal
      open={showImagePreview}
      onOpenChange={setShowImagePreview}
      imageUrl={profileImageUrl}
      name={name}
      subtitle={program || "Student"}
      badge={enrollmentNumber}
    />
  </>
  );
}
