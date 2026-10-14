"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { AcademicsTabs } from "@/app/components/academics/AcademicsTabs";
import { Skeleton } from "@/components/ui/skeleton";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: {
    id: string;
    name: string;
    code: string;
    departmentName: string;
    durationYears: number;
  } | null;
};

export default function StudentAcademicsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student/profile")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace("/dashboard");
          return;
        }
        if (!res.ok) {
          setError("Unable to load academic profile");
          return;
        }
        const data = await res.json();
        setProfile(data.student ?? null);
      })
      .catch(() => setError("Unable to connect to the server"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !profile) {
    return (
      <StudentShell
        active="/student/academics"
        title="Academics & Curriculum"
        subtitle="Course structure, enrolled subjects, and official syllabus"
      >
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId =
    profile.rollNumber != null ? String(profile.rollNumber) : profile.enrollmentNumber;

  return (
    <StudentShell
      active="/student/academics"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Academics & Curriculum"
      subtitle="Course structure, enrolled subjects, and official syllabus"
    >
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive font-medium">
          {error}
        </p>
      ) : (
        <AcademicsTabs profile={profile} />
      )}
    </StudentShell>
  );
}
