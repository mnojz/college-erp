"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoCard } from "@/app/components/student/InfoCard";
import { ProfileHero } from "@/app/components/student/ProfileHero";
import { StudentNav } from "@/app/components/student/StudentNav";
import { StudentSidebar } from "@/app/components/student/StudentSidebar";
import { studentAssets } from "@/app/components/student/assets";

type Profile = {
  admissionNo: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  admissionDate: string;
  user: { email: string; firstName: string; lastName: string; status: string };
  program: { name: string; code: string; durationYears: number; department: { name: string; code: string } } | null;
};

export default function StudentPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
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
  }, [router]);

  if (error) return <main className="profile-error">{error}</main>;
  if (!profile) return <main className="profile-loading">Loading profile...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const programName = profile.program?.name || "Not assigned";
  const departmentName = profile.program?.department.name || "Not assigned";
  const batch = profile.program
    ? `${new Date(profile.admissionDate).getFullYear()} - ${new Date(profile.admissionDate).getFullYear() + profile.program.durationYears}`
    : "Not provided";

  return (
    <div className="student-app-shell">
      <StudentNav name={fullName} studentId={profile.rollNumber || profile.admissionNo} avatarUrl={profile.profileImageUrl} />
      <div className="student-page-body">
        <StudentSidebar />
        <main className="student-profile-content">
          <ProfileHero name={fullName} email={profile.user.email} status={profile.user.status === "ACTIVE" ? "Active" : "Inactive"} program={programName} department={departmentName} admissionNo={profile.admissionNo} rollNumber={profile.rollNumber} profileImageUrl={profile.profileImageUrl} />
          <div className="profile-card-grid">
            <InfoCard title="Personal Information" icon={studentAssets.personal} rows={[["Full Name", fullName], ["Admission Date", new Date(profile.admissionDate).toLocaleDateString()], ["Gender", "Not provided"], ["Blood Group", "Not provided"], ["Nationality", "Not provided"], ["Religion", "Not provided"], ["Category", "Not provided"]]} />
            <InfoCard title="Contact Information" icon={studentAssets.contact} rows={[["Email Address", profile.user.email], ["Phone Number", "Not provided"], ["Current Address", "Not provided"], ["Permanent Address", "Not provided"], ["Emergency Contact", "Not provided"]]} />
            <InfoCard title="Academic Details" icon={studentAssets.academic} rows={[["Program", programName], ["Department", departmentName], ["Batch / Year", batch], ["Enrollment No.", profile.admissionNo], ["Roll Number", profile.rollNumber || "Not assigned"], ["Current CGPA", "Not provided"], ["Academic Advisor", "Not assigned"]]} />
            <InfoCard title="Guardian / Parent Details" icon={studentAssets.guardian} rows={[["Father's Name", "Not provided"], ["Mother's Name", "Not provided"], ["Guardian Phone", "Not provided"], ["Guardian Email", "Not provided"], ["Relation", "Not provided"]]} />
          </div>
        </main>
      </div>
    </div>
  );
}
