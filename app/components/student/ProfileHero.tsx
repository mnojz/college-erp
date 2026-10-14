"use client";

import { useState } from "react";
import {
  IconCalendar,
  IconCheck,
  IconCopy,
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
import { toast } from "sonner";
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
  onEdit?: () => void;
};

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
  onEdit,
}: ProfileHeroProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

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
      {/* ── Banner Backdrop ── */}
      <div className="relative h-28 sm:h-36 w-full bg-linear-to-r from-primary/25 via-primary/10 to-primary/5 dark:from-primary/20 dark:via-primary/10 dark:to-background border-b border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent opacity-80" />
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6 flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-background/80 backdrop-blur-md px-2.5 py-1 text-xs font-semibold shadow-xs"
          >
            <IconSparkles size={13} className="text-primary mr-1" />
            {batch || "Undergraduate"}
          </Badge>
        </div>
      </div>

      {/* ── Profile Header Info ── */}
      <div className="px-5 pb-5 sm:px-7 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16">
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

            <span
              className={`absolute bottom-1 right-1 size-4 rounded-full ring-2 ring-background pointer-events-none ${
                active ? "bg-emerald-500" : "bg-muted-foreground"
              }`}
              title={active ? "Active account" : "Inactive account"}
            />
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
            <Badge
              variant={active ? "default" : "secondary"}
              className={`gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                active
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : ""
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground"}`}
              />
              {active ? "Active Student" : status}
            </Badge>

            {reviewStatus === "PENDING_REVIEW" && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                Changes Pending Approval
              </Badge>
            )}
            {reviewStatus === "REJECTED" && (
              <Badge variant="destructive" className="text-xs">
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

          {/* ── Key Identity Tags with Quick-Copy ── */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
            {rollNumber != null && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
                <span className="text-muted-foreground font-medium">Roll No:</span>
                <span className="font-mono font-bold text-foreground">#{rollNumber}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(rollNumber), "Roll Number")}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                  title="Copy Roll Number"
                  aria-label="Copy Roll Number"
                >
                  {copiedKey === "Roll Number" ? (
                    <IconCheck size={13} className="text-emerald-500" />
                  ) : (
                    <IconCopy size={13} />
                  )}
                </button>
              </div>
            )}

            {admissionNo && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
                <IconId size={14} className="text-muted-foreground/80" />
                <span className="text-muted-foreground font-medium">Reg No:</span>
                <span className="font-mono font-semibold text-foreground">{admissionNo}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(admissionNo, "Registration ID")}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                  title="Copy Registration ID"
                  aria-label="Copy Registration ID"
                >
                  {copiedKey === "Registration ID" ? (
                    <IconCheck size={13} className="text-emerald-500" />
                  ) : (
                    <IconCopy size={13} />
                  )}
                </button>
              </div>
            )}

            {enrollmentNumber && enrollmentNumber !== admissionNo && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs">
                <span className="text-muted-foreground font-medium">Enrollment:</span>
                <span className="font-mono font-semibold text-foreground">{enrollmentNumber}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(enrollmentNumber, "Enrollment Number")}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                  title="Copy Enrollment Number"
                  aria-label="Copy Enrollment Number"
                >
                  {copiedKey === "Enrollment Number" ? (
                    <IconCheck size={13} className="text-emerald-500" />
                  ) : (
                    <IconCopy size={13} />
                  )}
                </button>
              </div>
            )}

            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto hidden md:inline-flex">
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
