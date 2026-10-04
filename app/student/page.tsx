"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoCard } from "@/app/components/student/InfoCard";
import { ProfileHero } from "@/app/components/student/ProfileHero";
import { StudentShell } from "@/app/components/student/StudentShell";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { ImageUploadCrop } from "@/app/components/common/ImageUploadCrop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconLayoutList,
  IconPhone,
  IconSchool,
  IconUser,
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
  rollNumber: string | null;
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
  user: { email: string; firstName: string; lastName: string; status: string };
  program: { name: string; code: string; durationYears: number; departmentName: string } | null;
  currentSemester: number | null;
};

/**
 * State of the self-service "Edit Profile" popup. Critical identity data
 * (name, gender, registration number, nationality, category, religion,
 * program, semester…) is intentionally absent — students can never edit it.
 */
type EditFormState = {
  profileImageUrl: string;
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
  const [showAll, setShowAll] = useState(false);
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
      profileImageUrl: profile.profileImageUrl ?? "",
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
      profileImageUrl: editForm.profileImageUrl,
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
      setEditSuccess("Profile updated successfully.");
      setEditForm((current) =>
        current ? { ...current, currentPassword: "", newPassword: "" } : current,
      );
    } catch {
      setEditError("Unable to reach the server");
    } finally {
      setSavingProfile(false);
    }
  }

  useEffect(() => {
    fetch("/api/student/profile")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          router.replace("/dashboard");
          return;
        }
        setProfile(result.student);
      })
      .catch(() => setError("Unable to reach the server"));

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

  if (error) return <main className="p-6 text-sm text-destructive">{error}</main>;
  if (!profile) return <main className="p-6 text-sm text-muted-foreground">Loading profile...</main>;

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
      studentId={profile.rollNumber || profile.enrollmentNumber}
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
        profileImageUrl={profile.profileImageUrl}
        onEdit={openEditModal}
      />
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoCard
          title="Personal Information"
          icon={IconUser}
          rows={[
            ["Full Name", fullName],
            ["Admission Date", new Date(profile.admissionDate).toLocaleDateString()],
            ["Gender", profile.gender || "Not provided"],
            ["Blood Group", profile.bloodGroup || "Not provided"],
            ["Nationality", profile.nationality || "Not provided"],
            ["Religion", profile.religion || "Not provided"],
            ["Category", profile.category || "Not provided"],
          ]}
        />
        <InfoCard
          title="Contact Information"
          icon={IconPhone}
          rows={[
            ["Email Address", profile.user.email],
            ["Phone Number", profile.phone || "Not provided"],
            ["Current Address", formatAddressConcise({
              localLevelName: profile.currLocalLevelName,
              localLevelType: profile.currLocalLevelType,
              ward: profile.currWard,
              districtName: profile.currDistrictName,
            }) || (profile.currSameAsPerm ? "Same as permanent address" : "Not provided")],
            ["Permanent Address", formatAddressConcise({
              localLevelName: profile.permLocalLevelName,
              localLevelType: profile.permLocalLevelType,
              ward: profile.permWard,
              districtName: profile.permDistrictName,
            }) || "Not provided"],
            ["Emergency Contact", profile.emergencyContact || "Not provided"],
          ]}
        />
        <InfoCard
          title="Academic Details"
          icon={IconSchool}
          rows={[
            ["Program", programName],
            ["Current Semester", semesterName],
            ["Department", departmentName],
            ["Batch / Year", batch],
            ["Enrollment No.", profile.enrollmentNumber],
            ["Registration ID", profile.registrationId],
            ["Roll Number", profile.rollNumber || "Not assigned"],
            ["Current CGPA", "Not provided"],
          ]}
        />
        <InfoCard
          title="Guardian / Parent Details"
          icon={IconUsersGroup}
          rows={[
            ["Guardian's Name", profile.guardianName || "Not provided"],
            ["Guardian Phone", profile.guardianPhone || "Not provided"],
            ["Guardian Email", profile.guardianEmail || "Not provided"],
            ["Relation", profile.guardianRelation || "Not provided"],
          ]}
        />
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAll(true)}
              aria-label="View all announcements"
            >
              <IconLayoutList size={16} aria-hidden="true" />
              View All ({announcements.length})
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

      {showAll && (
        <AdminModal
          title={`All Announcements (${announcements.length})`}
          onClose={() => setShowAll(false)}
          wide
        >
          <div className="flex flex-col gap-3">
            {announcements.map((a) => (
              <NoticePostCard
                key={a.id}
                notice={toNotice(a)}
                onOpen={() => setSelectedNotice(toNotice(a))}
              />
            ))}
          </div>
        </AdminModal>
      )}

      {showEdit && editForm && (
        <AdminModal title="Edit Profile" onClose={() => setShowEdit(false)} wide>
          <form className="flex flex-col gap-4" onSubmit={handleSaveProfile}>
            <ImageUploadCrop
              label="Profile Photo"
              value={editForm.profileImageUrl}
              onChange={(val) => setEditForm({ ...editForm, profileImageUrl: val })}
            />

            <p className="text-sm text-muted-foreground" style={{ marginTop: 2 }}>
              You can update your photo, contact and guardian details below. Critical records —
              name, gender, registration number, nationality, category, religion, program — are
              managed by the college office and cannot be changed here.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-blood-group">Blood Group</Label>
                <Select
                  value={editForm.bloodGroup || undefined}
                  onValueChange={(value) => setEditForm({ ...editForm, bloodGroup: value })}
                >
                  <SelectTrigger id="edit-blood-group" className="w-full">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="">Not specified</SelectItem>
                    {BLOOD_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="e.g. 98XXXXXXXX"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-emergency">Emergency Contact</Label>
                <Input
                  id="edit-emergency"
                  type="tel"
                  placeholder="Person to call in an emergency"
                  value={editForm.emergencyContact}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                />
              </div>
            </div>

            <h3 className="mt-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
              Permanent Address
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-perm-province">Province</Label>
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
                  <SelectTrigger id="edit-perm-province" className="w-full">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {getProvinces().map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-perm-district">District</Label>
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
                  <SelectTrigger id="edit-perm-district" className="w-full">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {editForm.permProvinceId &&
                      getProvince(editForm.permProvinceId)?.districts.map((d) => (
                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-perm-local-level">Municipality / Rural Municipality</Label>
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
                  <SelectTrigger id="edit-perm-local-level" className="w-full">
                    <SelectValue placeholder="Select local level" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {editForm.permProvinceId &&
                      editForm.permDistrictId &&
                      getDistrict(editForm.permProvinceId, editForm.permDistrictId)?.localLevels.map((l) => (
                        <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-perm-ward">Ward Number</Label>
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
                  <SelectTrigger id="edit-perm-ward" className="w-full">
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
                          editForm.permLocalLevelId
                        );
                        if (!ll?.totalWard) return null;
                        return Array.from({ length: ll.totalWard }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {i + 1}
                          </SelectItem>
                        ));
                      })()}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-perm-tole">Tole / Street</Label>
              <Input
                id="edit-perm-tole"
                type="text"
                placeholder="Your tole or street name"
                value={editForm.permTole}
                onChange={(e) => setEditForm({ ...editForm, permTole: e.target.value })}
              />
            </div>

            <h3 className="mt-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
              Current Address
            </h3>
            <div className="flex items-center gap-2 py-1">
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
              <Label htmlFor="edit-curr-same-as-perm" className="cursor-pointer font-normal">
                Same as permanent address
              </Label>
            </div>
            <div
              className="grid gap-3"
              style={{
                opacity: editForm.currSameAsPerm ? 0.5 : 1,
                pointerEvents: editForm.currSameAsPerm ? "none" : "auto",
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-curr-province">Province</Label>
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
                    <SelectTrigger id="edit-curr-province" className="w-full">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {getProvinces().map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-curr-district">District</Label>
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
                    <SelectTrigger id="edit-curr-district" className="w-full">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {editForm.currProvinceId &&
                        getProvince(editForm.currProvinceId)?.districts.map((d) => (
                          <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-curr-local-level">Municipality / Rural Municipality</Label>
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
                    <SelectTrigger id="edit-curr-local-level" className="w-full">
                      <SelectValue placeholder="Select local level" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {editForm.currProvinceId &&
                        editForm.currDistrictId &&
                        getDistrict(editForm.currProvinceId, editForm.currDistrictId)?.localLevels.map((l) => (
                          <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-curr-ward">Ward Number</Label>
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
                    <SelectTrigger id="edit-curr-ward" className="w-full">
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
                            editForm.currLocalLevelId
                          );
                          if (!ll?.totalWard) return null;
                          return Array.from({ length: ll.totalWard }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>
                              {i + 1}
                            </SelectItem>
                          ));
                        })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-curr-tole">Tole / Street</Label>
                <Input
                  id="edit-curr-tole"
                  type="text"
                  placeholder="Your tole or street name"
                  value={editForm.currTole}
                  onChange={(e) => setEditForm({ ...editForm, currTole: e.target.value })}
                />
              </div>
            </div>

            <h3 className="mt-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
              Parent / Guardian Details
            </h3>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-guardian-name">Guardian&apos;s Name</Label>
              <Input
                id="edit-guardian-name"
                type="text"
                value={editForm.guardianName}
                onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-guardian-phone">Guardian Phone</Label>
                <Input
                  id="edit-guardian-phone"
                  type="tel"
                  value={editForm.guardianPhone}
                  onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-guardian-email">Guardian Email</Label>
                <Input
                  id="edit-guardian-email"
                  type="email"
                  value={editForm.guardianEmail}
                  onChange={(e) => setEditForm({ ...editForm, guardianEmail: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-guardian-relation">Relation with Guardian</Label>
              <Select
                value={editForm.guardianRelation || undefined}
                onValueChange={(value) => setEditForm({ ...editForm, guardianRelation: value })}
              >
                <SelectTrigger id="edit-guardian-relation" className="w-full">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {GUARDIAN_RELATIONS.map((relation) => (
                    <SelectItem key={relation} value={relation}>
                      {relation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <h3 className="mt-1.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
              Security
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-current-password">Current Password</Label>
                <Input
                  id="edit-current-password"
                  type="password"
                  placeholder="Required to change your password"
                  value={editForm.currentPassword}
                  onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                  autoComplete="current-password"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-new-password">New Password</Label>
                <Input
                  id="edit-new-password"
                  type="password"
                  placeholder="Optional — min 8 characters"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {editError && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{editError}</p>}
            {editSuccess && (
              <p style={{ margin: 0, fontSize: 13, color: "#15803d" }}>{editSuccess}</p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save Changes"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}
      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </StudentShell>
  );
}
