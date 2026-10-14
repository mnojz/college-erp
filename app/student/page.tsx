"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfileHero } from "@/app/components/student/ProfileHero";
import { StudentShell } from "@/app/components/student/StudentShell";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";
import { ProfilePictureUpload } from "@/app/components/profile/ProfilePictureUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { startProgress, doneProgress } from "@/app/components/layout/RouteProgress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconBook2,
  IconBuilding,
  IconCalendar,
  IconCalendarCheck,
  IconCheck,
  IconChecklist,
  IconChevronRight,
  IconClipboardCheck,
  IconCompass,
  IconDroplet,
  IconEdit,
  IconHome,
  IconLayoutList,
  IconLoader2,
  IconLock,
  IconMail,
  IconMapPin,
  IconPhone,
  IconReport,
  IconSchool,
  IconAlertCircle,
  IconShieldCheck,
  IconUser,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import {
  getProvinces,
  getProvince,
  getDistrict,
  getLocalLevel,
  formatAddressConcise,
} from "@/app/lib/nepal-geo";



type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  admissionDate: string;
  // Personal information — managed by admins, read-only for the student.
  gender: string | null;
  bloodGroup: string | null;
  nationality: string | null;
  religion: string | null;
  category: string | null;
  // Contact details — editable by the student.
  phone: string | null;
  emergencyContact: string | null;
  // Structured permanent address
  permProvinceId: number | null;
  permProvinceName: string | null;
  permDistrictId: number | null;
  permDistrictName: string | null;
  permLocalLevelId: number | null;
  permLocalLevelName: string | null;
  permLocalLevelType: string | null;
  permWard: number | null;
  permTole: string | null;
  // Structured current address
  currSameAsPerm: boolean;
  currProvinceId: number | null;
  currProvinceName: string | null;
  currDistrictId: number | null;
  currDistrictName: string | null;
  currLocalLevelId: number | null;
  currLocalLevelName: string | null;
  currLocalLevelType: string | null;
  currWard: number | null;
  currTole: string | null;
  // Guardian / parent details — editable by the student.
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  guardianRelation: string | null;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    profileReviewStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
    pendingAvatarUrl: string | null;
    lastAvatarRejectedAt: string | null;
  };
  program: { name: string; code: string; durationYears: number; departmentName: string } | null;
  currentSemester: number | null;
};

/**
 * State of the self-service "Edit Profile" popup. Critical identity data
 * (name, gender, registration number, nationality, category, religion,
 * program, semester…) is intentionally absent — students can never edit it.
 */
type EditFormState = {
  bloodGroup: string;
  phone: string;
  // Permanent address (structured)
  permProvinceId: number | null;
  permDistrictId: number | null;
  permLocalLevelId: number | null;
  permWard: number | null;
  permTole: string;
  // Current address
  currSameAsPerm: boolean;
  currProvinceId: number | null;
  currDistrictId: number | null;
  currLocalLevelId: number | null;
  currWard: number | null;
  currTole: string;
  emergencyContact: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelation: string;
  currentPassword: string;
  newPassword: string;
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GUARDIAN_RELATIONS = [
  "Father",
  "Mother",
  "Grandfather",
  "Grandmother",
  "Uncle",
  "Aunt",
  "Sibling",
  "Other",
];

type Announcement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  teacherId: string | null;
  semester: number | null;
  author: { firstName: string; lastName: string } | null;
  subject: { id: string; name: string; code: string } | null;
  program: { id: string; name: string; code: string } | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
};

/** Raw announcement row → client-safe notice shape for cards/modal. */
function toNotice(a: Announcement): NoticeDetailData {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
    author: a.author,
    scope:
      a.teacherId && a.subject && a.program && a.semester != null
        ? {
            subjectName: a.subject.name,
            subjectCode: a.subject.code,
            programName: a.program.name,
            programCode: a.program.code,
            semester: a.semester,
          }
        : null,
    attachment:
      a.attachmentFileName && a.attachmentSize !== null
        ? {
            fileName: a.attachmentFileName,
            mimeType: a.attachmentMimeType ?? "application/octet-stream",
            size: a.attachmentSize,
          }
        : null,
  };
}

export default function StudentPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<NoticeDetailData | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [error, setError] = useState("");

  /** Open the self-service edit popup pre-filled with the current profile. */
  function openEditModal() {
    if (!profile) return;
    setEditError("");
    setEditSuccess("");
    setEditForm({
      bloodGroup: profile.bloodGroup ?? "",
      phone: profile.phone ?? "",
      // Permanent address
      permProvinceId: profile.permProvinceId ?? null,
      permDistrictId: profile.permDistrictId ?? null,
      permLocalLevelId: profile.permLocalLevelId ?? null,
      permWard: profile.permWard ?? null,
      permTole: profile.permTole ?? "",
      // Current address
      currSameAsPerm: profile.currSameAsPerm ?? true,
      currProvinceId: profile.currProvinceId ?? null,
      currDistrictId: profile.currDistrictId ?? null,
      currLocalLevelId: profile.currLocalLevelId ?? null,
      currWard: profile.currWard ?? null,
      currTole: profile.currTole ?? "",
      emergencyContact: profile.emergencyContact ?? "",
      guardianName: profile.guardianName ?? "",
      guardianPhone: profile.guardianPhone ?? "",
      guardianEmail: profile.guardianEmail ?? "",
      guardianRelation: profile.guardianRelation ?? "",
      currentPassword: "",
      newPassword: "",
    });
    setShowEdit(true);
  }

  /**
   * Save the self-service profile edits. Only student-editable fields are sent —
   * name, gender, registration data, etc. never leave this page. Changing the
   * password additionally requires the current password, which the API verifies
   * against the stored hash. The college email is NOT self-editable: it is the
   * account identity, so the field is read-only and never submitted.
   */
  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !editForm) return;

    const changingPassword = editForm.newPassword !== "";

    if (changingPassword && editForm.newPassword.length < 8) {
      setEditError("New password must be at least 8 characters.");
      return;
    }
    if (changingPassword && !editForm.currentPassword) {
      setEditError("Enter your current password to change your password.");
      return;
    }

    setSavingProfile(true);
    setEditError("");

    const body: Record<string, unknown> = {
      bloodGroup: editForm.bloodGroup,
      phone: editForm.phone,
      // Permanent address
      permProvinceId: editForm.permProvinceId,
      permDistrictId: editForm.permDistrictId,
      permLocalLevelId: editForm.permLocalLevelId,
      permWard: editForm.permWard,
      permTole: editForm.permTole,
      // Current address
      currSameAsPerm: editForm.currSameAsPerm,
      currProvinceId: editForm.currProvinceId,
      currDistrictId: editForm.currDistrictId,
      currLocalLevelId: editForm.currLocalLevelId,
      currWard: editForm.currWard,
      currTole: editForm.currTole,
      emergencyContact: editForm.emergencyContact,
      guardianName: editForm.guardianName,
      guardianPhone: editForm.guardianPhone,
      guardianEmail: editForm.guardianEmail,
      guardianRelation: editForm.guardianRelation,
    };
    if (changingPassword) body.currentPassword = editForm.currentPassword;
    if (changingPassword) body.newPassword = editForm.newPassword;

    try {
      const response = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setEditError(result.error ?? "Unable to update your profile");
        return;
      }
      setProfile(result.student);
      setEditForm((current) =>
        current ? { ...current, currentPassword: "", newPassword: "" } : current,
      );
      setEditSuccess(
        result.pendingReview
          ? "Submitted for review — an administrator will approve your changes before they appear on your profile."
          : "Profile updated successfully.",
      );
    } catch {
      setEditError("Unable to reach the server");
    } finally {
      setSavingProfile(false);
    }
  }

  useEffect(() => {
    startProgress();
    fetch("/api/student/profile")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          router.replace("/dashboard");
          return;
        }
        setProfile(result.student);
      })
      .catch(() => setError("Unable to reach the server"))
      .finally(() => {
        doneProgress();
      });

    // Campus bulletins + teacher notices scoped to this student's program/semester.
    fetch("/api/announcements")
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        setAnnouncements(result.announcements ?? []);
      })
      .catch(() => {
        // announcements are non-critical; profile already loaded
      });
  }, [router]);

  if (error) {
    return (
      <StudentShell active="/dashboard" name="Student Portal" studentId="">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <IconAlertCircle className="mx-auto size-8 text-destructive mb-2" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      </StudentShell>
    );
  }

  if (!profile) {
    return (
      <StudentShell active="/dashboard" name="" studentId="">
        <div className="space-y-6">
          {/* Hero Skeleton */}
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Skeleton className="size-24 rounded-2xl shrink-0" />
              <div className="space-y-3 flex-1 min-w-0">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-72" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
              <Skeleton className="h-10 w-28 rounded-lg shrink-0" />
            </div>
          </div>

          {/* Quick Metrics Skeleton */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-border/70 bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="size-5 rounded" />
                </div>
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>

          {/* Quick Navigation Cards Skeleton */}
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Details Section Skeleton */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-card p-6 space-y-4">
              <Skeleton className="h-6 w-44" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-6 space-y-4">
              <Skeleton className="h-6 w-44" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const programName = profile.program?.name || "Not assigned";
  const departmentName = profile.program?.departmentName || "Not assigned";
  const semesterName = profile.currentSemester
    ? `Semester ${profile.currentSemester}`
    : "Not assigned";
  const batch = profile.program
    ? `${new Date(profile.admissionDate).getFullYear()} - ${new Date(profile.admissionDate).getFullYear() + profile.program.durationYears}`
    : "Not provided";

  return (
    <StudentShell
      active="/dashboard"
      name={fullName}
      studentId={profile.rollNumber != null ? String(profile.rollNumber) : profile.enrollmentNumber}
      avatarUrl={profile.profileImageUrl}
    >
      <ProfileHero
        name={fullName}
        email={profile.user.email}
        status={profile.user.status === "ACTIVE" ? "Active" : "Inactive"}
        program={programName}
        department={departmentName}
        admissionNo={profile.registrationId}
        rollNumber={profile.rollNumber}
        enrollmentNumber={profile.enrollmentNumber}
        batch={batch !== "Not provided" ? batch : undefined}
        semester={profile.currentSemester}
        profileImageUrl={profile.profileImageUrl}
        reviewStatus={profile.user.profileReviewStatus}
        onEdit={openEditModal}
      />

      {/* ── Quick Overview / Metric Ribbon ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Current Term */}
        <Card className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <IconCalendar className="size-4 text-primary shrink-0" />
            <span>Current Term</span>
          </div>
          <div className="mt-2 text-base sm:text-lg font-bold tracking-tight text-foreground">
            {semesterName}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {profile.program ? `${profile.program.durationYears} Years Duration` : "Academic Cycle"}
          </div>
        </Card>

        {/* Enrollment Status */}
        <Card className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <IconChecklist className="size-4 text-emerald-500 shrink-0" />
            <span>Enrollment Status</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-base sm:text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            {profile.user.status === "ACTIVE" ? "Enrolled" : "Inactive"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Good Standing
          </div>
        </Card>

        {/* Department / Faculty */}
        <Card className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <IconBuilding className="size-4 text-blue-500 shrink-0" />
            <span>Department</span>
          </div>
          <div className="mt-2 text-base sm:text-lg font-bold tracking-tight text-foreground truncate" title={departmentName}>
            {departmentName}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {profile.program?.code ? `Code: ${profile.program.code}` : "Faculty Assigned"}
          </div>
        </Card>

        {/* Blood Group / Medical */}
        <Card className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <IconDroplet className="size-4 text-rose-500 shrink-0" />
            <span>Blood Group</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-base sm:text-lg font-bold tracking-tight text-foreground">
            {profile.bloodGroup ? (
              <Badge variant="outline" className="border-rose-500/40 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold px-2 py-0.5 text-xs">
                {profile.bloodGroup}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground/70 font-normal italic">Not specified</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Medical Emergency Info
          </div>
        </Card>
      </div>

      {/* ── Main Detail Grid (Asymmetric 12-col) ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Left Column (4 cols): Contacts, Guardian & Shortcuts ── */}
        <div className="space-y-6 lg:col-span-4">
          {/* Contact & Emergency Card */}
          <Card className="rounded-2xl border border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:px-5 pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconPhone size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold">Contact &amp; Emergency</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Official contact details</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4 text-sm">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Email Address
                </span>
                <a
                  href={`mailto:${profile.user.email}`}
                  className="mt-0.5 flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors break-all"
                >
                  <IconMail size={15} className="text-muted-foreground shrink-0" />
                  <span>{profile.user.email}</span>
                </a>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Phone Number
                </span>
                {profile.phone ? (
                  <a
                    href={`tel:${profile.phone}`}
                    className="mt-0.5 flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors font-mono"
                  >
                    <IconPhone size={15} className="text-muted-foreground shrink-0" />
                    <span>{profile.phone}</span>
                  </a>
                ) : (
                  <p className="text-xs italic text-muted-foreground/60 mt-0.5">Not provided</p>
                )}
              </div>

              {/* Emergency Contact Highlight Box */}
              <div className="rounded-xl border border-rose-500/25 bg-rose-50/60 dark:bg-rose-950/20 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-rose-800 dark:text-rose-300">
                  <IconAlertCircle size={15} />
                  <span>Emergency Contact</span>
                </div>
                {profile.emergencyContact ? (
                  <a
                    href={`tel:${profile.emergencyContact}`}
                    className="mt-1 block font-mono font-bold text-rose-900 dark:text-rose-200 hover:underline"
                  >
                    {profile.emergencyContact}
                  </a>
                ) : (
                  <p className="text-rose-700/70 dark:text-rose-400/70 italic mt-1">
                    No emergency contact assigned
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Guardian / Parent Details Card */}
          <Card className="rounded-2xl border border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:px-5 pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconUsersGroup size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold">Parent &amp; Guardian</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Family &amp; primary contact</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Guardian Name
                  </span>
                  <p className="font-semibold text-foreground truncate">
                    {profile.guardianName || <span className="text-xs italic font-normal text-muted-foreground/60">Not provided</span>}
                  </p>
                </div>
                {profile.guardianRelation && (
                  <Badge variant="outline" className="text-xs font-semibold shrink-0">
                    {profile.guardianRelation}
                  </Badge>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Guardian Phone
                </span>
                {profile.guardianPhone ? (
                  <a
                    href={`tel:${profile.guardianPhone}`}
                    className="mt-0.5 flex items-center gap-2 font-medium font-mono text-foreground hover:text-primary transition-colors"
                  >
                    <IconPhone size={14} className="text-muted-foreground shrink-0" />
                    <span>{profile.guardianPhone}</span>
                  </a>
                ) : (
                  <p className="text-xs italic text-muted-foreground/60 mt-0.5">Not provided</p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Guardian Email
                </span>
                {profile.guardianEmail ? (
                  <a
                    href={`mailto:${profile.guardianEmail}`}
                    className="mt-0.5 flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors break-all text-xs"
                  >
                    <IconMail size={14} className="text-muted-foreground shrink-0" />
                    <span>{profile.guardianEmail}</span>
                  </a>
                ) : (
                  <p className="text-xs italic text-muted-foreground/60 mt-0.5">Not provided</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Portal Navigation */}
          <Card className="rounded-2xl border border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:px-5 pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconCompass size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold">Student Portal Services</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Quick academic access</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-2.5 divide-y divide-border/40">
              <Link
                href="/student/results"
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-xs font-medium group"
              >
                <span className="flex items-center gap-2.5 text-foreground">
                  <IconReport size={16} className="text-primary group-hover:scale-110 transition-transform" />
                  Exam Results &amp; Marksheets
                </span>
                <IconChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/student/attendance"
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-xs font-medium group"
              >
                <span className="flex items-center gap-2.5 text-foreground">
                  <IconCalendarCheck size={16} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  Attendance History
                </span>
                <IconChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/student/exams"
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-xs font-medium group"
              >
                <span className="flex items-center gap-2.5 text-foreground">
                  <IconClipboardCheck size={16} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                  Exam Registrations &amp; Schedules
                </span>
                <IconChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/student/academics"
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-xs font-medium group"
              >
                <span className="flex items-center gap-2.5 text-foreground">
                  <IconBook2 size={16} className="text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform" />
                  Curriculum &amp; Syllabus
                </span>
                <IconChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column (8 cols): Academic, Personal & Addresses ── */}
        <div className="space-y-6 lg:col-span-8">
          {/* Card 1: Academic & Program Details */}
          <Card className="rounded-2xl border border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:px-6 pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconSchool size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold">Academic &amp; Enrollment Records</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Program, department, and registration particulars</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Enrolled Program
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {programName}
                  </p>
                  {profile.program?.code && (
                    <span className="font-mono text-xs text-muted-foreground">
                      Code: {profile.program.code}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Department
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {departmentName}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Current Semester
                  </span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant="outline" className="font-bold text-xs bg-primary/10 text-primary border-primary/30">
                      {semesterName}
                    </Badge>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Academic Batch / Duration
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {batch}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Registration ID
                  </span>
                  <p className="font-mono font-semibold text-foreground mt-0.5">
                    {profile.registrationId}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Enrollment Number
                  </span>
                  <p className="font-mono font-semibold text-foreground mt-0.5">
                    {profile.enrollmentNumber}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Class Roll Number
                  </span>
                  <p className="font-mono font-semibold text-foreground mt-0.5">
                    {profile.rollNumber != null ? `#${profile.rollNumber}` : "Not assigned"}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Admission Date
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {new Date(profile.admissionDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Personal & Demographic Information */}
          <Card className="rounded-2xl border border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:px-6 pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconUser size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold">Personal &amp; Identity Details</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Government &amp; personal records</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Full Legal Name
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">{fullName}</p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Gender
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {profile.gender || <span className="text-xs italic font-normal text-muted-foreground/60">Not specified</span>}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Blood Group
                  </span>
                  <div className="mt-0.5">
                    {profile.bloodGroup ? (
                      <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-400 font-bold text-xs">
                        {profile.bloodGroup}
                      </Badge>
                    ) : (
                      <span className="text-xs italic font-normal text-muted-foreground/60">Not specified</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Nationality
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {profile.nationality || "Nepali"}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Religion
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {profile.religion || <span className="text-xs italic font-normal text-muted-foreground/60">Not specified</span>}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Category / Caste
                  </span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {profile.category || <span className="text-xs italic font-normal text-muted-foreground/60">Not specified</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Residential Addresses */}
          <Card className="rounded-2xl border border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:px-6 pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconMapPin size={16} />
                </span>
                <div>
                  <CardTitle className="text-sm font-semibold">Residential Addresses</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Permanent domicile and current residence</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Permanent Address Box */}
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                      <IconMapPin size={14} />
                      Permanent Address
                    </span>
                    {profile.permProvinceName && (
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {profile.permProvinceName}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-relaxed">
                    {formatAddressConcise({
                      localLevelName: profile.permLocalLevelName,
                      localLevelType: profile.permLocalLevelType,
                      ward: profile.permWard,
                      districtName: profile.permDistrictName,
                    }) || <span className="text-xs italic font-normal text-muted-foreground/60">Not provided</span>}
                  </p>
                  {profile.permTole && (
                    <p className="text-xs text-muted-foreground">
                      Street / Tole: <span className="font-medium text-foreground">{profile.permTole}</span>
                    </p>
                  )}
                </div>

                {/* Current Address Box */}
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
                      <IconHome size={14} className="text-muted-foreground" />
                      Current Address
                    </span>
                    {profile.currSameAsPerm ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-medium">
                        Same as Permanent
                      </Badge>
                    ) : (
                      profile.currProvinceName && (
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {profile.currProvinceName}
                        </Badge>
                      )
                    )}
                  </div>
                  {profile.currSameAsPerm ? (
                    <div className="text-xs text-muted-foreground pt-1">
                      Current living address matches permanent domicile registered with the college.
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-foreground leading-relaxed">
                        {formatAddressConcise({
                          localLevelName: profile.currLocalLevelName,
                          localLevelType: profile.currLocalLevelType,
                          ward: profile.currWard,
                          districtName: profile.currDistrictName,
                        }) || <span className="text-xs italic font-normal text-muted-foreground/60">Not provided</span>}
                      </p>
                      {profile.currTole && (
                        <p className="text-xs text-muted-foreground">
                          Street / Tole: <span className="font-medium text-foreground">{profile.currTole}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {announcements.length > 0 && (
        <section className="mt-7">
          <header className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Announcements</h2>
              <p className="text-sm text-muted-foreground">
                Campus updates and notices from your teachers
              </p>
            </div>
            <Button asChild variant="ghost" aria-label="View all announcements">
              <Link href="/student/announcements">
                <IconLayoutList size={16} aria-hidden="true" />
                View All ({announcements.length})
              </Link>
            </Button>
          </header>

          {/* Latest announcements — a single responsive row of 3–4 cards.
              The View All popup lists everything. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {announcements.slice(0, 4).map((a) => (
              <NoticePostCard
                key={a.id}
                notice={toNotice(a)}
                onOpen={() => setSelectedNotice(toNotice(a))}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {showEdit && editForm && (
        <Dialog open={showEdit} onOpenChange={(open) => !open && setShowEdit(false)}>
          <DialogContent className="max-h-[88vh] sm:max-w-2xl lg:max-w-3xl flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
            {/* Header */}
            <DialogHeader className="p-5 sm:p-6 border-b border-border/70 bg-card shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <IconEdit className="size-5 text-primary" aria-hidden="true" />
                    Edit Student Profile
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Update your personal contact details, residential address, guardian records, and login security.
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="text-[11px] font-semibold text-muted-foreground border-border/70 bg-muted/40 self-start sm:self-center shrink-0">
                  {profile.enrollmentNumber}{profile.program?.code ? ` · ${profile.program.code}` : ""}
                </Badge>
              </div>
            </DialogHeader>

            <form onSubmit={handleSaveProfile} className="flex flex-col flex-1 overflow-hidden">
              <Tabs defaultValue="personal" className="flex flex-col flex-1 overflow-hidden">
                {/* Tabs Bar */}
                <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-border/60 bg-muted/20 shrink-0">
                  <TabsList className="grid grid-cols-4 w-full h-9 bg-muted/60 p-1">
                    <TabsTrigger
                      value="personal"
                      className="gap-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
                    >
                      <IconUser className="size-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Personal</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="address"
                      className="gap-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
                    >
                      <IconMapPin className="size-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Addresses</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="guardian"
                      className="gap-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
                    >
                      <IconUsers className="size-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Guardian</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="security"
                      className="gap-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-xs"
                    >
                      <IconLock className="size-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Security</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Scrollable Tab Content Body */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
                  {/* Tab 1: Personal & Contact */}
                  <TabsContent value="personal" className="m-0 space-y-4">
                    {/* Photo Upload Card */}
                    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                      <ProfilePictureUpload
                        currentAvatarUrl={profile.profileImageUrl}
                        avatarPending={Boolean(profile.user.pendingAvatarUrl)}
                        avatarRejected={Boolean(profile.user.lastAvatarRejectedAt)}
                      />
                    </div>

                    {/* Official Records Notice */}
                    <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs text-muted-foreground">
                      <IconShieldCheck className="size-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                      <div>
                        <strong className="font-semibold text-foreground">Official College Identity Records</strong>
                        <p className="mt-0.5 leading-relaxed">
                          Legal name ({profile.user.firstName} {profile.user.lastName}), gender, registration number, nationality, and academic enrollment are centrally managed by the administration.
                        </p>
                      </div>
                    </div>

                    {/* Personal & Contact Grid */}
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4 shadow-2xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <IconPhone className="size-3.5 text-primary" aria-hidden="true" />
                        Contact & Medical Information
                      </h4>

                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-blood-group" className="text-xs font-semibold">Blood Group</Label>
                          <Select
                            value={editForm.bloodGroup || undefined}
                            onValueChange={(value) => setEditForm({ ...editForm, bloodGroup: value })}
                          >
                            <SelectTrigger id="edit-blood-group" className="w-full h-9 text-xs">
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="">Not specified</SelectItem>
                              {BLOOD_GROUPS.map((group) => (
                                <SelectItem key={group} value={group} className="text-xs">
                                  {group}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-phone" className="text-xs font-semibold">Primary Phone</Label>
                          <Input
                            id="edit-phone"
                            type="tel"
                            placeholder="e.g. 98XXXXXXXX"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-emergency" className="text-xs font-semibold">Emergency Contact</Label>
                          <Input
                            id="edit-emergency"
                            type="tel"
                            placeholder="Emergency phone number"
                            value={editForm.emergencyContact}
                            onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Addresses */}
                  <TabsContent value="address" className="m-0 space-y-4">
                    {/* Permanent Address */}
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3.5 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <IconHome className="size-4 text-primary" aria-hidden="true" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Permanent Address (Domicile)
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-perm-province" className="text-xs font-semibold">Province</Label>
                          <Select
                            value={editForm.permProvinceId?.toString() ?? ""}
                            onValueChange={(value) =>
                              setEditForm({
                                ...editForm,
                                permProvinceId: value ? Number(value) : null,
                                permDistrictId: null,
                                permLocalLevelId: null,
                              })
                            }
                          >
                            <SelectTrigger id="edit-perm-province" className="w-full h-9 text-xs">
                              <SelectValue placeholder="Select province" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {getProvinces().map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-perm-district" className="text-xs font-semibold">District</Label>
                          <Select
                            value={editForm.permDistrictId?.toString() ?? ""}
                            onValueChange={(value) =>
                              setEditForm({
                                ...editForm,
                                permDistrictId: value ? Number(value) : null,
                                permLocalLevelId: null,
                              })
                            }
                            disabled={!editForm.permProvinceId}
                          >
                            <SelectTrigger id="edit-perm-district" className="w-full h-9 text-xs">
                              <SelectValue placeholder="Select district" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {editForm.permProvinceId &&
                                getProvince(editForm.permProvinceId)?.districts.map((d) => (
                                  <SelectItem key={d.id} value={d.id.toString()} className="text-xs">
                                    {d.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-perm-local-level" className="text-xs font-semibold">Municipality / Local Level</Label>
                          <Select
                            value={editForm.permLocalLevelId?.toString() ?? ""}
                            onValueChange={(value) =>
                              setEditForm({
                                ...editForm,
                                permLocalLevelId: value ? Number(value) : null,
                              })
                            }
                            disabled={!editForm.permDistrictId}
                          >
                            <SelectTrigger id="edit-perm-local-level" className="w-full h-9 text-xs">
                              <SelectValue placeholder="Select municipality" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {editForm.permProvinceId &&
                                editForm.permDistrictId &&
                                getDistrict(editForm.permProvinceId, editForm.permDistrictId)?.localLevels.map((l) => (
                                  <SelectItem key={l.id} value={l.id.toString()} className="text-xs">
                                    {l.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-perm-ward" className="text-xs font-semibold">Ward Number</Label>
                          <Select
                            value={editForm.permWard?.toString() ?? ""}
                            onValueChange={(value) =>
                              setEditForm({
                                ...editForm,
                                permWard: value ? Number(value) : null,
                              })
                            }
                            disabled={!editForm.permLocalLevelId}
                          >
                            <SelectTrigger id="edit-perm-ward" className="w-full h-9 text-xs">
                              <SelectValue placeholder="Select ward" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {editForm.permProvinceId &&
                                editForm.permDistrictId &&
                                editForm.permLocalLevelId &&
                                (() => {
                                  const ll = getLocalLevel(
                                    editForm.permProvinceId,
                                    editForm.permDistrictId,
                                    editForm.permLocalLevelId,
                                  );
                                  if (!ll?.totalWard) return null;
                                  return Array.from({ length: ll.totalWard }, (_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()} className="text-xs">
                                      Ward {i + 1}
                                    </SelectItem>
                                  ));
                                })()}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="edit-perm-tole" className="text-xs font-semibold">Tole / Street Name</Label>
                        <Input
                          id="edit-perm-tole"
                          type="text"
                          placeholder="e.g. New Baneshwor, Marg-4"
                          value={editForm.permTole}
                          onChange={(e) => setEditForm({ ...editForm, permTole: e.target.value })}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    {/* Current Address */}
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3.5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <IconMapPin className="size-4 text-primary" aria-hidden="true" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Current Address (Residence)
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border/60 px-3 py-1.5">
                          <Checkbox
                            id="edit-curr-same-as-perm"
                            checked={editForm.currSameAsPerm}
                            onCheckedChange={(checked) =>
                              setEditForm({
                                ...editForm,
                                currSameAsPerm: !!checked,
                                currProvinceId: checked ? editForm.permProvinceId : null,
                                currDistrictId: checked ? editForm.permDistrictId : null,
                                currLocalLevelId: checked ? editForm.permLocalLevelId : null,
                                currWard: checked ? editForm.permWard : null,
                                currTole: checked ? editForm.permTole : "",
                              })
                            }
                          />
                          <Label htmlFor="edit-curr-same-as-perm" className="cursor-pointer text-xs font-medium">
                            Same as permanent address
                          </Label>
                        </div>
                      </div>

                      <div
                        className="space-y-3.5 transition-opacity"
                        style={{
                          opacity: editForm.currSameAsPerm ? 0.45 : 1,
                          pointerEvents: editForm.currSameAsPerm ? "none" : "auto",
                        }}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-curr-province" className="text-xs font-semibold">Province</Label>
                            <Select
                              value={editForm.currProvinceId?.toString() ?? ""}
                              onValueChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  currProvinceId: value ? Number(value) : null,
                                  currDistrictId: null,
                                  currLocalLevelId: null,
                                })
                              }
                            >
                              <SelectTrigger id="edit-curr-province" className="w-full h-9 text-xs">
                                <SelectValue placeholder="Select province" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                {getProvinces().map((p) => (
                                  <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="edit-curr-district" className="text-xs font-semibold">District</Label>
                            <Select
                              value={editForm.currDistrictId?.toString() ?? ""}
                              onValueChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  currDistrictId: value ? Number(value) : null,
                                  currLocalLevelId: null,
                                })
                              }
                              disabled={!editForm.currProvinceId}
                            >
                              <SelectTrigger id="edit-curr-district" className="w-full h-9 text-xs">
                                <SelectValue placeholder="Select district" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                {editForm.currProvinceId &&
                                  getProvince(editForm.currProvinceId)?.districts.map((d) => (
                                    <SelectItem key={d.id} value={d.id.toString()} className="text-xs">
                                      {d.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-curr-local-level" className="text-xs font-semibold">Municipality / Local Level</Label>
                            <Select
                              value={editForm.currLocalLevelId?.toString() ?? ""}
                              onValueChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  currLocalLevelId: value ? Number(value) : null,
                                })
                              }
                              disabled={!editForm.currDistrictId}
                            >
                              <SelectTrigger id="edit-curr-local-level" className="w-full h-9 text-xs">
                                <SelectValue placeholder="Select municipality" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                {editForm.currProvinceId &&
                                  editForm.currDistrictId &&
                                  getDistrict(editForm.currProvinceId, editForm.currDistrictId)?.localLevels.map((l) => (
                                    <SelectItem key={l.id} value={l.id.toString()} className="text-xs">
                                      {l.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="edit-curr-ward" className="text-xs font-semibold">Ward Number</Label>
                            <Select
                              value={editForm.currWard?.toString() ?? ""}
                              onValueChange={(value) =>
                                setEditForm({
                                  ...editForm,
                                  currWard: value ? Number(value) : null,
                                })
                              }
                              disabled={!editForm.currLocalLevelId}
                            >
                              <SelectTrigger id="edit-curr-ward" className="w-full h-9 text-xs">
                                <SelectValue placeholder="Select ward" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                {editForm.currProvinceId &&
                                  editForm.currDistrictId &&
                                  editForm.currLocalLevelId &&
                                  (() => {
                                    const ll = getLocalLevel(
                                      editForm.currProvinceId,
                                      editForm.currDistrictId,
                                      editForm.currLocalLevelId,
                                    );
                                    if (!ll?.totalWard) return null;
                                    return Array.from({ length: ll.totalWard }, (_, i) => (
                                      <SelectItem key={i + 1} value={(i + 1).toString()} className="text-xs">
                                        Ward {i + 1}
                                      </SelectItem>
                                    ));
                                  })()}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-curr-tole" className="text-xs font-semibold">Tole / Street Name</Label>
                          <Input
                            id="edit-curr-tole"
                            type="text"
                            placeholder="Current address street name"
                            value={editForm.currTole}
                            onChange={(e) => setEditForm({ ...editForm, currTole: e.target.value })}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Guardian & Family */}
                  <TabsContent value="guardian" className="m-0 space-y-4">
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4 shadow-2xs">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <IconUsers className="size-3.5 text-primary" aria-hidden="true" />
                          Parent or Legal Guardian Information
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Authorized family contact on record for official communications and college emergency situations.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-guardian-name" className="text-xs font-semibold">Guardian&apos;s Full Name</Label>
                          <Input
                            id="edit-guardian-name"
                            type="text"
                            placeholder="Full name of parent or guardian"
                            value={editForm.guardianName}
                            onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-guardian-relation" className="text-xs font-semibold">Relationship</Label>
                          <Select
                            value={editForm.guardianRelation || undefined}
                            onValueChange={(value) => setEditForm({ ...editForm, guardianRelation: value })}
                          >
                            <SelectTrigger id="edit-guardian-relation" className="w-full h-9 text-xs">
                              <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {GUARDIAN_RELATIONS.map((relation) => (
                                <SelectItem key={relation} value={relation} className="text-xs">
                                  {relation}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-guardian-phone" className="text-xs font-semibold">Guardian Phone Number</Label>
                          <Input
                            id="edit-guardian-phone"
                            type="tel"
                            placeholder="Guardian contact phone"
                            value={editForm.guardianPhone}
                            onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-guardian-email" className="text-xs font-semibold">Guardian Email Address</Label>
                          <Input
                            id="edit-guardian-email"
                            type="email"
                            placeholder="guardian@example.com"
                            value={editForm.guardianEmail}
                            onChange={(e) => setEditForm({ ...editForm, guardianEmail: e.target.value })}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 4: Account Security */}
                  <TabsContent value="security" className="m-0 space-y-4">
                    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4 shadow-2xs">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <IconLock className="size-3.5 text-primary" aria-hidden="true" />
                          Login Credentials & Password
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Change your college portal password. Leave password fields empty if you do not want to change it.
                        </p>
                      </div>

                      {/* Read-only Identity Email */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Primary Account Email (Institutional)</Label>
                        <Input
                          disabled
                          readOnly
                          value={profile.user.email}
                          className="h-9 text-xs bg-muted/50 cursor-not-allowed font-mono text-muted-foreground"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Institutional login email is managed by college administration.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 pt-1 border-t border-border/60">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-current-password" className="text-xs font-semibold">Current Password</Label>
                          <Input
                            id="edit-current-password"
                            type="password"
                            placeholder="Enter current password"
                            value={editForm.currentPassword}
                            onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                            autoComplete="current-password"
                            className="h-9 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="edit-new-password" className="text-xs font-semibold">New Password</Label>
                          <Input
                            id="edit-new-password"
                            type="password"
                            placeholder="Minimum 8 characters"
                            value={editForm.newPassword}
                            onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                            autoComplete="new-password"
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Feedback Alerts */}
                  {editError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
                      <IconAlertCircle className="size-4 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Error Updating Profile</strong>
                        <p className="mt-0.5">{editError}</p>
                      </div>
                    </div>
                  )}

                  {editSuccess && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <IconCheck className="size-4 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Success</strong>
                        <p className="mt-0.5">{editSuccess}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Modal Footer */}
                <div className="p-4 sm:px-6 border-t border-border/70 bg-card flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Changes to photo require administrative approval before going live.
                  </span>
                  <div className="flex items-center gap-2.5 ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEdit(false)}
                      className="h-9 px-4 text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingProfile}
                      className="h-9 px-5 text-xs font-bold gap-1.5 shadow-sm"
                    >
                      {savingProfile ? (
                        <>
                          <IconLoader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          Saving…
                        </>
                      ) : (
                        "Save Profile Changes"
                      )}
                    </Button>
                  </div>
                </div>
              </Tabs>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </StudentShell>
  );
}
