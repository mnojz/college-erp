"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentNav } from "@/app/components/student/StudentNav";
import { StudentSidebar } from "@/app/components/student/StudentSidebar";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string; departmentName: string } | null;
};

type Subject = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
  program: { name: string; code: string };
};

export default function StudentSubjectsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSemester, setSelectedSemester] = useState<string>("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, subjectsRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/subjects"),
        ]);

        if (!profileRes.ok || !subjectsRes.ok) {
          router.replace("/");
          return;
        }

        const profileData = await profileRes.json();
        const subjectsData = await subjectsRes.json();

        setProfile(profileData.student);

        const allSubjects: Subject[] = subjectsData.subjects ?? [];
        // Filter subjects for the student's program if available
        const programSubjects = profileData.student?.program?.id
          ? allSubjects.filter((s) => s.programId === profileData.student.program.id)
          : allSubjects;

        setSubjects(programSubjects);
      } catch {
        setError("Unable to load enrolled subjects");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading curriculum...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

  const semesters = Array.from(
    new Set(subjects.map((s) => `Semester ${s.semester}`))
  ).sort();

  const filteredSubjects =
    selectedSemester === "ALL"
      ? subjects
      : subjects.filter(
          (s) => `Semester ${s.semester}` === selectedSemester
        );

  return (
    <div className="student-app-shell">
      <StudentNav name={fullName} studentId={studentId} avatarUrl={profile.profileImageUrl} />
      <div className="student-page-body">
        <StudentSidebar />
        <main className="student-profile-content">
          <header className="admin-page-heading" style={{ marginBottom: "24px" }}>
            <p>Curriculum &amp; Coursework</p>
            <h1>Program Subjects &amp; Modules</h1>
          </header>

          <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
            <article className="admin-metric-card">
              <span>Total Subjects</span>
              <strong>{subjects.length}</strong>
              <small>Curriculum modules</small>
            </article>
            <article className="admin-metric-card">
              <span>Department</span>
              <strong style={{ fontSize: "1.2rem" }}>
                {profile.program?.departmentName ?? "Engineering"}
              </strong>
              <small>{profile.program?.name ?? "Department"}</small>
            </article>
            <article className="admin-metric-card">
              <span>Program Code</span>
              <strong style={{ fontSize: "1.6rem" }}>{profile.program?.code ?? "N/A"}</strong>
              <small>Degree stream</small>
            </article>
          </section>

          {semesters.length > 1 && (
            <div style={{ marginBottom: "20px", display: "flex", gap: "12px", alignItems: "center" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Filter by Semester:
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                style={{ width: "auto", minWidth: "240px", padding: "8px 12px" }}
              >
                <option value="ALL">All Semesters</option>
                {semesters.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredSubjects.length === 0 ? (
            <div className="profile-info-card" style={{ padding: "32px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>
                No curriculum subjects listed for this program yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "18px",
              }}
            >
              {filteredSubjects.map((sub) => (
                <div key={sub.id} className="profile-info-card" style={{ padding: "20px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <span className="eyebrow">{sub.code}</span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        padding: "3px 8px",
                        borderRadius: "99px",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        fontWeight: "600",
                      }}
                    >
                      Semester {sub.semester}
                    </span>
                  </div>
                  <h3 style={{ margin: "4px 0 12px", fontSize: "1.15rem", fontWeight: "600" }}>
                    {sub.name}
                  </h3>
                  <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Program:</strong> {sub.program.code} ({sub.program.name})
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Semester:</strong> {sub.semester}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
