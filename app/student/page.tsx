"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoCard } from "@/app/components/student/InfoCard";
import { ProfileHero } from "@/app/components/student/ProfileHero";
import { StudentShell } from "@/app/components/student/StudentShell";
import { studentAssets } from "@/app/components/student/assets";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  admissionDate: string;
  user: { email: string; firstName: string; lastName: string; status: string };
  program: { name: string; code: string; durationYears: number; departmentName: string } | null;
  currentSemester: number | null;
};

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
  const [error, setError] = useState("");

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
      />
      <div className="profile-card-grid">
        <InfoCard
          title="Personal Information"
          icon={studentAssets.personal}
          rows={[
            ["Full Name", fullName],
            ["Admission Date", new Date(profile.admissionDate).toLocaleDateString()],
            ["Gender", "Not provided"],
            ["Blood Group", "Not provided"],
            ["Nationality", "Not provided"],
            ["Religion", "Not provided"],
            ["Category", "Not provided"],
          ]}
        />
        <InfoCard
          title="Contact Information"
          icon={studentAssets.contact}
          rows={[
            ["Email Address", profile.user.email],
            ["Phone Number", "Not provided"],
            ["Current Address", "Not provided"],
            ["Permanent Address", "Not provided"],
            ["Emergency Contact", "Not provided"],
          ]}
        />
        <InfoCard
          title="Academic Details"
          icon={studentAssets.academic}
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
          icon={studentAssets.guardian}
          rows={[
            ["Father's Name", "Not provided"],
            ["Mother's Name", "Not provided"],
            ["Guardian Phone", "Not provided"],
            ["Guardian Email", "Not provided"],
            ["Relation", "Not provided"],
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
          </header>
          <div className="public-list notice-list">
            {announcements.map((a) => (
              <NoticePostCard
                key={a.id}
                notice={toNotice(a)}
                onOpen={() => setSelectedNotice(toNotice(a))}
              />
            ))}
          </div>
        </section>
      )}

      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </StudentShell>
  );
}
