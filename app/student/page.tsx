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
import {
  IconLayoutList,
  IconPhone,
  IconSchool,
  IconUser,
  IconUsersGroup,
} from "@tabler/icons-react";

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
  currentAddress: string | null;
  permanentAddress: string | null;
  emergencyContact: string | null;
  // Guardian / parent details — editable by the student.
  fatherName: string | null;
  motherName: string | null;
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
  email: string;
  phone: string;
  currentAddress: string;
  permanentAddress: string;
  emergencyContact: string;
  fatherName: string;
  motherName: string;
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
      email: profile.user.email,
      phone: profile.phone ?? "",
      currentAddress: profile.currentAddress ?? "",
      permanentAddress: profile.permanentAddress ?? "",
      emergencyContact: profile.emergencyContact ?? "",
      fatherName: profile.fatherName ?? "",
      motherName: profile.motherName ?? "",
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
   * email or the password additionally requires the current password, which the
   * API verifies against the stored hash.
   */
  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !editForm) return;

    const emailChanged = editForm.email.trim().toLowerCase() !== profile.user.email.toLowerCase();
    const changingPassword = editForm.newPassword !== "";

    if (emailChanged && !editForm.currentPassword) {
      setEditError("Enter your current password to change your email address.");
      return;
    }
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

    const body: Record<string, string> = {
      profileImageUrl: editForm.profileImageUrl,
      bloodGroup: editForm.bloodGroup,
      phone: editForm.phone,
      currentAddress: editForm.currentAddress,
      permanentAddress: editForm.permanentAddress,
      emergencyContact: editForm.emergencyContact,
      fatherName: editForm.fatherName,
      motherName: editForm.motherName,
      guardianPhone: editForm.guardianPhone,
      guardianEmail: editForm.guardianEmail,
      guardianRelation: editForm.guardianRelation,
    };
    if (emailChanged) body.email = editForm.email.trim();
    if (emailChanged || changingPassword) body.currentPassword = editForm.currentPassword;
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
          router.replace("/");
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

  if (error) return <main className="profile-error">{error}</main>;
  if (!profile) return <main className="profile-loading">Loading profile...</main>;

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
      active="/student"
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
      <div className="profile-card-grid">
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
            ["Current Address", profile.currentAddress || "Not provided"],
            ["Permanent Address", profile.permanentAddress || "Not provided"],
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
            ["Father's Name", profile.fatherName || "Not provided"],
            ["Mother's Name", profile.motherName || "Not provided"],
            ["Guardian Phone", profile.guardianPhone || "Not provided"],
            ["Guardian Email", profile.guardianEmail || "Not provided"],
            ["Relation", profile.guardianRelation || "Not provided"],
          ]}
        />
      </div>

      {announcements.length > 0 && (
        <section style={{ marginTop: "28px" }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Announcements</h2>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
                Campus updates and notices from your teachers
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowAll(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <IconLayoutList size={16} aria-hidden="true" />
              View All ({announcements.length})
            </button>
          </header>

          {/* Latest announcements — a single responsive row of 3–4 cards.
              The View All popup lists everything. */}
          <div className="notice-latest-row">
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
          <div className="notice-all-modal-list">
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
        <AdminModal title="Edit Profile" onClose={() => setShowEdit(false)}>
          <form className="modal-form" onSubmit={handleSaveProfile}>
            <ImageUploadCrop
              label="Profile Photo"
              value={editForm.profileImageUrl}
              onChange={(val) => setEditForm({ ...editForm, profileImageUrl: val })}
            />

            <p className="form-hint" style={{ marginTop: 2 }}>
              You can update your photo, contact and guardian details below. Critical records —
              name, gender, registration number, nationality, category, religion, program — are
              managed by the college office and cannot be changed here.
            </p>

            <div className="inline-pair">
              <label>
                Blood Group
                <select
                  value={editForm.bloodGroup}
                  onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })}
                >
                  <option value="">Not specified</option>
                  {BLOOD_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Phone Number
                <input
                  type="tel"
                  placeholder="e.g. 98XXXXXXXX"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </label>
              <label>
                Emergency Contact
                <input
                  type="tel"
                  placeholder="Person to call in an emergency"
                  value={editForm.emergencyContact}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Current Address
                <input
                  type="text"
                  placeholder="Where you live now"
                  value={editForm.currentAddress}
                  onChange={(e) => setEditForm({ ...editForm, currentAddress: e.target.value })}
                />
              </label>
              <label>
                Permanent Address
                <input
                  type="text"
                  placeholder="Your family home address"
                  value={editForm.permanentAddress}
                  onChange={(e) => setEditForm({ ...editForm, permanentAddress: e.target.value })}
                />
              </label>
            </div>

            <h3
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--ink-soft, #64748b)",
              }}
            >
              Parent / Guardian Details
            </h3>
            <div className="inline-pair">
              <label>
                Father&apos;s Name
                <input
                  type="text"
                  value={editForm.fatherName}
                  onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                />
              </label>
              <label>
                Mother&apos;s Name
                <input
                  type="text"
                  value={editForm.motherName}
                  onChange={(e) => setEditForm({ ...editForm, motherName: e.target.value })}
                />
              </label>
            </div>

            <div className="inline-pair">
              <label>
                Guardian Phone
                <input
                  type="tel"
                  value={editForm.guardianPhone}
                  onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                />
              </label>
              <label>
                Guardian Email
                <input
                  type="email"
                  value={editForm.guardianEmail}
                  onChange={(e) => setEditForm({ ...editForm, guardianEmail: e.target.value })}
                />
              </label>
            </div>

            <label>
              Relation with Guardian
              <select
                value={editForm.guardianRelation}
                onChange={(e) => setEditForm({ ...editForm, guardianRelation: e.target.value })}
              >
                <option value="">Not specified</option>
                {GUARDIAN_RELATIONS.map((relation) => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </select>
            </label>

            <h3
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--ink-soft, #64748b)",
              }}
            >
              Security
            </h3>
            <div className="inline-pair">
              <label>
                Current Password
                <input
                  type="password"
                  placeholder="Required to change email / password"
                  value={editForm.currentPassword}
                  onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                  autoComplete="current-password"
                />
              </label>
              <label>
                New Password
                <input
                  type="password"
                  placeholder="Optional — min 8 characters"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  autoComplete="new-password"
                />
              </label>
            </div>

            {editError && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{editError}</p>}
            {editSuccess && (
              <p style={{ margin: 0, fontSize: 13, color: "#15803d" }}>{editSuccess}</p>
            )}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save Changes"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setShowEdit(false)}>
                Cancel
              </button>
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
