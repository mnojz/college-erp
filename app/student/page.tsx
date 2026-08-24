"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Attendance = {
  status: "PRESENT" | "ABSENT";
  session: {
    heldAt: string;
    offering: { section: string; course: { code: string; name: string } };
  };
};

type Student = {
  admissionNo: string;
  rollNumber: string | null;
  user: { firstName: string; lastName: string };
  attendance: Attendance[];
};
type Result = { marks: string; grade: string | null; assessment: { name: string; maxMarks: string; assessmentDate: string | null; offering: { course: { code: string; name: string }; term: { name: string } } } };

export default function StudentPage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student/attendance")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          router.replace(response.status === 403 ? "/" : "/login");
          return;
        }
        setStudent(result.student);
        const resultsResponse = await fetch("/api/student/results");
        if (resultsResponse.ok) setResults((await resultsResponse.json()).results ?? []);
      })
      .catch(() => setError("Unable to reach the server"));
  }, [router]);

  const summary = useMemo(() => {
    const records = student?.attendance ?? [];
    const present = records.filter((record) => record.status === "PRESENT").length;
    return { present, absent: records.length - present, total: records.length };
  }, [student]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Student workspace</p>
          <h1>{student ? `${student.user.firstName} ${student.user.lastName}` : "Your progress"}</h1>
          {student && <p className="panel-copy">Roll {student.rollNumber ?? "Not assigned"} · {student.admissionNo}</p>}
        </div>
        <button className="quiet-button" type="button" onClick={logout}>Sign out</button>
      </header>

      {error && <p className="banner error-banner" role="alert">{error}</p>}

      <section className="admin-grid" aria-label="Attendance summary">
        <article className="metric-card"><span>Total classes</span><strong>{summary.total}</strong></article>
        <article className="metric-card"><span>Present</span><strong>{summary.present}</strong></article>
        <article className="metric-card"><span>Absent</span><strong>{summary.absent}</strong></article>
        <article className="metric-card"><span>Attendance</span><strong>{summary.total ? `${Math.round((summary.present / summary.total) * 100)}%` : "-"}</strong></article>
      </section>

      <section className="roster-section">
        <div className="section-heading">
          <div><p className="eyebrow">Recent record</p><h2>Attendance history</h2></div>
        </div>
        {student?.attendance.length ? (
          <div className="history-list">
            {student.attendance.map((record, index) => (
              <div className="history-row" key={`${record.session.heldAt}-${index}`}>
                <span><strong>{record.session.offering.course.code}</strong><small>{record.session.offering.course.name}</small></span>
                <time>{new Date(record.session.heldAt).toLocaleDateString()}</time>
                <b className={record.status === "PRESENT" ? "status-present" : "status-absent"}>{record.status}</b>
              </div>
            ))}
          </div>
        ) : <p className="empty-state">No attendance has been recorded yet.</p>}
      </section>
      <section className="roster-section">
        <div className="section-heading"><div><p className="eyebrow">Academic record</p><h2>Results</h2></div></div>
        {results.length ? <div className="history-list">{results.map((result, index) => <div className="history-row" key={`${result.assessment.name}-${index}`}><span><strong>{result.assessment.offering.course.code} · {result.assessment.name}</strong><small>{result.assessment.offering.course.name} · {result.assessment.offering.term.name}</small></span><time>{result.marks} / {result.assessment.maxMarks}</time><b>{result.grade ?? "-"}</b></div>)}</div> : <p className="empty-state">No results have been published yet.</p>}
      </section>
    </main>
  );
}
