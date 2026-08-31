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
  id: string;
  marks: number | string;
  grade: string | null;
  assessment: {
    id: string;
    name: string;
    semester: number;
    maxMarks: number | string;
    assessmentDate: string | null;
    subject: { code: string; name: string };
    program: { name: string };
  };
};

type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
};

type SubjectOption = { code: string; name: string };

type Summary = { totalAssessments: number; averagePercentage: number };

export default function StudentResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSubject, setFilterSubject] = useState("ALL");
  const [filterSemester, setFilterSemester] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadData() {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (filterSubject !== "ALL") params.set("subject", filterSubject);
        if (filterSemester !== "ALL") params.set("semester", filterSemester);

        const [profileRes, resultsRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch(`/api/student/results?${params.toString()}`),
        ]);

        if (!profileRes.ok) {
          // Bad session/profile is not recoverable here — back to dashboard.
          router.replace("/dashboard");
          return;
        }
        if (!resultsRes.ok) {
          setError("Unable to load results from server");
          return;
        }

        const profileData = await profileRes.json();
        const resultsData = await resultsRes.json();

        setProfile(profileData.student);
        setResults(resultsData.results ?? []);
        setSubjects(resultsData.subjects ?? []);
        setSummary(resultsData.summary ?? null);
        setPagination(resultsData.pagination ?? null);
      } catch {
        setError("Unable to load results from server");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, page, filterSubject, filterSemester]);

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading results...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

  // Subject list comes from the API (computed across the FULL result set, so a
  // selected filter never disappears from the dropdown); fall back to whatever
  // subjects are visible on the current page.
  const subjectOptions: SubjectOption[] =
    subjects.length > 0
      ? subjects
      : Array.from(
          new Map(
            results.map((r) => [
              r.assessment.subject.code,
              { code: r.assessment.subject.code, name: r.assessment.subject.name },
            ]),
          ).values(),
        ).sort((a, b) => a.code.localeCompare(b.code));

  // Rows are filtered, sorted and paginated server-side.
  const pageResults = results;

  // Header stats cover ALL of the student's results (server-computed), not
  // just the current page.
  const totalAssessments = summary?.totalAssessments ?? pagination?.total ?? results.length;
  const avgPercentage =
    summary?.averagePercentage ??
    (pageResults.length > 0
      ? Number(
          (
            pageResults.reduce(
              (acc, curr) => acc + (Number(curr.marks) / Number(curr.assessment.maxMarks)) * 100,
              0
            ) / pageResults.length
          ).toFixed(1),
        )
      : 0);

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

          {subjectOptions.length > 0 && (
            <div
              style={{
                marginBottom: "18px",
                display: "flex",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {subjectOptions.length > 1 && (
                <>
                  <label style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                    Filter by Subject:
                  </label>
                  <select
                    value={filterSubject}
                    onChange={(e) => {
                      setFilterSubject(e.target.value);
                      setPage(1);
                    }}
                    style={{ width: "auto", minWidth: "220px", padding: "8px 12px" }}
                  >
                    <option value="ALL">All Subjects</option>
                    {subjectOptions.map((sub) => (
                      <option key={sub.code} value={sub.code}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Filter by Semester:
              </label>
              <select
                value={filterSemester}
                onChange={(e) => {
                  setFilterSemester(e.target.value);
                  setPage(1);
                }}
                style={{ width: "auto", minWidth: "140px", padding: "8px 12px" }}
              >
                <option value="ALL">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={String(sem)}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>
          )}

          {pageResults.length === 0 ? (
            <div className="profile-info-card" style={{ padding: "32px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>
                {totalAssessments > 0
                  ? "No results match the selected filters."
                  : "No published assessment results found yet."}
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
                  {pageResults.map((item) => {
                    const marks = Number(item.marks);
                    const maxMarks = Number(item.assessment.maxMarks);
                    const pct = maxMarks > 0 ? ((marks / maxMarks) * 100).toFixed(1) : "0";
                    const isPassing = marks >= maxMarks * 0.4;

                    return (
                      <tr
                        key={item.id}
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

          {pagination && pagination.totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginTop: "16px",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Showing {pageResults.length} of {pagination.total} results
              </span>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: page <= 1 ? "default" : "pointer",
                    opacity: page <= 1 ? 0.5 : 1,
                    fontSize: "0.8rem",
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: pagination.hasMore ? "pointer" : "default",
                    opacity: pagination.hasMore ? 1 : 0.5,
                    fontSize: "0.8rem",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
    </StudentShell>
  );
}
