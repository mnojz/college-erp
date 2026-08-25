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

type AttendanceRecord = {
  status: "PRESENT" | "ABSENT";
  session: {
    sessionDate: string;
    class: {
      subject: { code: string; name: string };
      semester?: number;
    };
  };
};

export default function StudentAttendancePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, attRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/student/attendance"),
        ]);

        if (!profileRes.ok || !attRes.ok) {
          router.replace("/");
          return;
        }

        const profileData = await profileRes.json();
        const attData = await attRes.json();

        setProfile(profileData.student);
        setRecords(attData.student?.attendanceRecords ?? []);
      } catch {
        setError("Unable to load attendance records");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading attendance...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

  const totalSessions = records.length;
  const presentSessions = records.filter((r) => r.status === "PRESENT").length;
  const absentSessions = totalSessions - presentSessions;
  const overallPercentage =
    totalSessions > 0 ? ((presentSessions / totalSessions) * 100).toFixed(1) : "0";

  // Calculate subject-wise metrics
  const subjectMap = new Map<string, { code: string; name: string; present: number; total: number }>();
  for (const record of records) {
    const key = record.session.class.subject.code;
    const current = subjectMap.get(key) || {
      code: record.session.class.subject.code,
      name: record.session.class.subject.name,
      present: 0,
      total: 0,
    };
    current.total += 1;
    if (record.status === "PRESENT") current.present += 1;
    subjectMap.set(key, current);
  }

  const subjectStats = Array.from(subjectMap.values());

  const filteredRecords =
    selectedSubject === "ALL"
      ? records
      : records.filter((r) => r.session.class.subject.code === selectedSubject);

  return (
    <StudentShell
      active="/student/attendance"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Lecture & Lab Attendance Records"
      subtitle="Attendance Tracking"
    >

          <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
            <article className="admin-metric-card">
              <span>Overall Attendance</span>
              <strong
                style={{
                  color: Number(overallPercentage) >= 75 ? "#16a34a" : "#dc2626",
                }}
              >
                {overallPercentage}%
              </strong>
              <small>{Number(overallPercentage) >= 75 ? "Eligible for examinations" : "Below 75% threshold"}</small>
            </article>
            <article className="admin-metric-card">
              <span>Total Classes</span>
              <strong>{totalSessions}</strong>
              <small>Conducted sessions</small>
            </article>
            <article className="admin-metric-card">
              <span>Present</span>
              <strong style={{ color: "#16a34a" }}>{presentSessions}</strong>
              <small>Attended classes</small>
            </article>
            <article className="admin-metric-card">
              <span>Absent</span>
              <strong style={{ color: "#dc2626" }}>{absentSessions}</strong>
              <small>Missed classes</small>
            </article>
          </section>

          {/* Subject Breakdown Card */}
          {subjectStats.length > 0 && (
            <div className="profile-info-card" style={{ marginBottom: "24px", padding: "20px" }}>
              <h2 style={{ padding: "0 0 16px 0", fontSize: "1rem" }}>Subject-wise Attendance Breakdown</h2>
              <div style={{ display: "grid", gap: "14px" }}>
                {subjectStats.map((sub) => {
                  const pct = sub.total > 0 ? (sub.present / sub.total) * 100 : 0;
                  const isSafe = pct >= 75;
                  return (
                    <div key={sub.code} style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <div>
                          <strong>{sub.code}</strong> — {sub.name}
                        </div>
                        <div>
                          <span style={{ fontWeight: "700", color: isSafe ? "#16a34a" : "#dc2626" }}>
                            {pct.toFixed(1)}%
                          </span>{" "}
                          <span style={{ color: "var(--ink-soft)", fontSize: "0.82rem" }}>
                            ({sub.present}/{sub.total})
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: "8px",
                          width: "100%",
                          background: "#e2e8f0",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: isSafe ? "#16a34a" : "#dc2626",
                            transition: "width 300ms ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          {subjectStats.length > 1 && (
            <div style={{ marginBottom: "18px", display: "flex", gap: "12px", alignItems: "center" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                Filter Logs by Subject:
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{ width: "auto", minWidth: "220px", padding: "8px 12px" }}
              >
                <option value="ALL">All Subjects</option>
                {subjectStats.map((sub) => (
                  <option key={sub.code} value={sub.code}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Daily Attendance Log Table */}
          {filteredRecords.length === 0 ? (
            <div className="profile-info-card" style={{ padding: "32px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>
                No attendance sessions recorded yet.
              </p>
            </div>
          ) : (
            <div className="profile-info-card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", background: "#f8fafc", color: "var(--ink-soft)" }}>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Date</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Subject</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Semester</th>
                    <th style={{ padding: "14px 18px", fontWeight: "600" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((item, idx) => {
                    const isPresent = item.status === "PRESENT";
                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--line)",
                          transition: "background 120ms ease",
                        }}
                      >
                        <td style={{ padding: "14px 18px", fontWeight: "500" }}>
                          {new Date(item.session.sessionDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <strong>{item.session.class.subject.code}</strong>
                          <div style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>
                            {item.session.class.subject.name}
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px", color: "var(--ink-soft)" }}>
                          {item.session.class.semester ? `Sem ${item.session.class.semester}` : "—"}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: "700",
                              background: isPresent ? "#dcfce7" : "#fee2e2",
                              color: isPresent ? "#15803d" : "#b91c1c",
                            }}
                          >
                            {isPresent ? "PRESENT" : "ABSENT"}
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
