"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  user: { email: string; firstName: string; lastName: string };
  program: { name: string; code: string } | null;
};

type ResultRecord = {
  marks: number | string;
  grade: string | null;
  assessment: {
    name: string;
    maxMarks: number | string;
    assessmentDate: string | null;
    subject: { code: string; name: string };
    program: { name: string };
  };
};

export default function StudentResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSubject, setFilterSubject] = useState("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, resultsRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/student/results"),
        ]);

        if (!profileRes.ok || !resultsRes.ok) {
          router.replace("/dashboard");
          return;
        }

        const profileData = await profileRes.json();
        const resultsData = await resultsRes.json();

        setProfile(profileData.student);
        setResults(resultsData.results ?? []);
      } catch {
        setError("Unable to load results from server");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading results...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

  const subjects = Array.from(
    new Set(results.map((r) => `${r.assessment.subject.code} - ${r.assessment.subject.name}`))
  );

  const filteredResults =
    filterSubject === "ALL"
      ? results
      : results.filter(
          (r) => `${r.assessment.subject.code} - ${r.assessment.subject.name}` === filterSubject
        );

  const totalAssessments = results.length;
  const avgPercentage =
    totalAssessments > 0
      ? (
          results.reduce(
            (acc, curr) => acc + (Number(curr.marks) / Number(curr.assessment.maxMarks)) * 100,
            0
          ) / totalAssessments
        ).toFixed(1)
      : "0";

  return (
    <StudentShell
      active="/student/results"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Examination & Assessment Results"
      subtitle="Academic Performance"
    >

          <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
            <article className="admin-metric-card">
              <span>Assessments Taken</span>
              <strong>{totalAssessments}</strong>
              <small>Recorded tests &amp; exams</small>
            </article>
            <article className="admin-metric-card">
              <span>Average Score</span>
              <strong>{avgPercentage}%</strong>
              <small>Across all subjects</small>
            </article>
            <article className="admin-metric-card">
              <span>Program</span>
              <strong style={{ fontSize: "1.4rem" }}>{profile.program?.code ?? "N/A"}</strong>
              <small>{profile.program?.name ?? "Enrolled Program"}</small>
            </article>
          </section>

          {subjects.length > 1 && (
            <div style={{ marginBottom: "18px", display: "flex", gap: "12px", alignItems: "center" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Filter by Subject:
              </label>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                style={{ width: "auto", minWidth: "220px", padding: "8px 12px" }}
              >
                <option value="ALL">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredResults.length === 0 ? (
            <div className="profile-info-card" style={{ padding: "32px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>
                No published assessment results found yet.
              </p>
            </div>
          ) : (
            <div className="profile-info-card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", background: "#f8fafc", color: "var(--ink-soft)" }}>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Subject</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Assessment</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Date</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Marks Obtained</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Percentage</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((item, idx) => {
                    const marks = Number(item.marks);
                    const maxMarks = Number(item.assessment.maxMarks);
                    const pct = maxMarks > 0 ? ((marks / maxMarks) * 100).toFixed(1) : "0";
                    const isPassing = marks >= maxMarks * 0.4;

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--line)",
                          transition: "background 120ms ease",
                        }}
                      >
                        <td style={{ padding: "14px 18px" }}>
                          <strong>{item.assessment.subject.code}</strong>
                          <div style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>
                            {item.assessment.subject.name}
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px", fontWeight: "500" }}>
                          {item.assessment.name}
                        </td>
                        <td style={{ padding: "14px 18px", color: "var(--ink-soft)" }}>
                          {item.assessment.assessmentDate
                            ? new Date(item.assessment.assessmentDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td style={{ padding: "14px 18px", fontWeight: "600" }}>
                          {marks} / {maxMarks}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              color: isPassing ? "#16a34a" : "#dc2626",
                              fontWeight: "600",
                            }}
                          >
                            {pct}%
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: "700",
                              background: isPassing ? "#dcfce7" : "#fee2e2",
                              color: isPassing ? "#15803d" : "#b91c1c",
                            }}
                          >
                            {item.grade || (isPassing ? "PASS" : "FAIL")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
    </StudentShell>
  );
}
