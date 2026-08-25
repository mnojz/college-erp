"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";

type Student = {
  id: string;
  enrollmentNumber: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  user: { firstName: string; lastName: string };
};

type ClassItem = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: { code: string; name: string };
  semester?: number;
  program: {
    name: string;
    code: string;
    students: Student[];
  };
};

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
};

export default function TeacherAttendancePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId],
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [attRes, profRes] = await Promise.all([
          fetch("/api/attendance"),
          fetch("/api/teacher/profile"),
        ]);

        if (attRes.status === 403 || attRes.status === 401 || profRes.status === 403 || profRes.status === 401) {
          router.replace("/");
          return;
        }

        const attResult = await attRes.json();
        const profResult = await profRes.json();

        if (!attRes.ok) {
          setError(attResult.error ?? "Unable to load classes");
          return;
        }

        setClasses(attResult.classes ?? []);
        if (attResult.classes?.length > 0) {
          setSelectedClassId(attResult.classes[0].id);
        }

        if (profRes.ok && profResult.teacher) {
          setTeacherInfo({
            firstName: profResult.teacher.user.firstName,
            lastName: profResult.teacher.user.lastName,
            employeeNo: profResult.teacher.employeeNo,
            profileImageUrl: profResult.teacher.profileImageUrl,
          });
        }
      } catch {
        setError("Unable to reach the server");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  function toggleStudent(studentId: string) {
    setPresentStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function selectClass(classId: string) {
    setSelectedClassId(classId);
    setPresentStudentIds(new Set());
    setMessage("");
    setError("");
  }

  function selectAll() {
    if (!selectedClass) return;
    setPresentStudentIds(new Set(selectedClass.program.students.map((s) => s.id)));
  }

  function clearAll() {
    setPresentStudentIds(new Set());
  }

  async function submitAttendance() {
    if (!selectedClass) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass.id,
          sessionDate: new Date(sessionDate).toISOString(),
          presentStudentIds: [...presentStudentIds],
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to submit attendance");
        return;
      }
      const total = selectedClass.program.students.length;
      const present = presentStudentIds.size;
      setMessage(`Attendance successfully recorded: ${present} Present, ${total - present} Absent.`);
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalStudents = selectedClass?.program.students.length ?? 0;
  const presentCount = presentStudentIds.size;
  const absentCount = totalStudents - presentCount;
  const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(0) : "0";

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    if (!searchQuery.trim()) return selectedClass.program.students;
    const q = searchQuery.toLowerCase();
    return selectedClass.program.students.filter(
      (s) =>
        s.user.firstName.toLowerCase().includes(q) ||
        s.user.lastName.toLowerCase().includes(q) ||
        s.enrollmentNumber.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q)),
    );
  }, [selectedClass, searchQuery]);

  return (
    <TeacherShell
      title="Class Attendance Management"
      subtitle="Roll Call & Attendance Logs"
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Faculty Member"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      {/* Attendance Control Card */}
      <section className="profile-info-card" style={{ padding: "22px", marginBottom: "20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 1.8fr) minmax(180px, 1fr) auto",
            gap: "16px",
            alignItems: "end",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              Select Class / Subject
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => selectClass(e.target.value)}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "inherit",
              }}
            >
              {classes.length === 0 && <option value="">No assigned classes found</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subject.code} · {c.subject.name} ({c.dayOfWeek})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              Session Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "inherit",
              }}
            />
          </div>

          <div style={{ textAlign: "right", paddingBottom: "4px" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", display: "block" }}>
              Enrolled in Program
            </span>
            <strong style={{ fontSize: "1.1rem", color: "#0ea5e9" }}>
              {selectedClass?.program.code || "—"} ({totalStudents} Students)
            </strong>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="admin-metric-grid" style={{ marginBottom: "20px" }}>
        <article className="admin-metric-card">
          <span>Enrolled Students</span>
          <strong>{totalStudents}</strong>
          <small>Total in {selectedClass?.program.code ?? "class"}</small>
        </article>
        <article className="admin-metric-card">
          <span>Marked Present</span>
          <strong style={{ color: "#16a34a" }}>{presentCount}</strong>
          <small>In-person attendance</small>
        </article>
        <article className="admin-metric-card">
          <span>Marked Absent</span>
          <strong style={{ color: "#dc2626" }}>{absentCount}</strong>
          <small>Absentee students</small>
        </article>
        <article className="admin-metric-card">
          <span>Attendance Rate</span>
          <strong style={{ color: "#0ea5e9" }}>{attendanceRate}%</strong>
          <small>Current session</small>
        </article>
      </section>

      {/* Error & Success Messages */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            marginBottom: "16px",
            fontSize: "0.88rem",
          }}
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#ecfdf5",
            color: "#047857",
            border: "1px solid #a7f3d0",
            marginBottom: "16px",
            fontSize: "0.88rem",
          }}
          role="status"
        >
          {message}
        </div>
      )}

      {/* Roster & Roll Call Card */}
      <section className="profile-info-card" style={{ padding: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--line, #e2e8f0)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, padding: 0, fontSize: "1.15rem", fontWeight: "700" }}>
              Student Roll Call Checklist
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              {selectedClass ? `${selectedClass.subject.code}: ${selectedClass.subject.name}` : "Select a class"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="search"
              placeholder="Search student or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "200px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line, #e2e8f0)",
                fontSize: "0.82rem",
                background: "var(--panel, #fff)",
                color: "inherit",
              }}
            />
            <button
              type="button"
              onClick={selectAll}
              disabled={!selectedClass || totalStudents === 0}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "inherit",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Mark All Present
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={!selectedClass || totalStudents === 0}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line, #e2e8f0)",
                background: "var(--panel, #fff)",
                color: "inherit",
                fontSize: "0.8rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
            Loading student roster...
          </p>
        ) : !selectedClass || totalStudents === 0 ? (
          <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
            No enrolled students in this class program yet.
          </p>
        ) : filteredStudents.length === 0 ? (
          <p className="empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
            No students matching &quot;{searchQuery}&quot;
          </p>
        ) : (
          <div style={{ display: "grid", gap: "8px", marginTop: "16px" }}>
            {filteredStudents.map((student) => {
              const isPresent = presentStudentIds.has(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: `1px solid ${isPresent ? "#86efac" : "var(--line, #e2e8f0)"}`,
                    background: isPresent ? "rgba(34, 197, 94, 0.06)" : "var(--panel, #fff)",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        background: isPresent ? "#dcfce7" : "#f1f5f9",
                        color: isPresent ? "#15803d" : "#475569",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.85rem",
                        fontWeight: "700",
                      }}
                    >
                      {student.user.firstName[0]}
                      {student.user.lastName[0]}
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.92rem" }}>
                        {student.user.firstName} {student.user.lastName}
                      </strong>
                      <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                        Roll: {student.rollNumber || "N/A"} · Enrollment: {student.enrollmentNumber}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span
                      style={{
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
                    <input
                      type="checkbox"
                      checked={isPresent}
                      onChange={() => toggleStudent(student.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "18px",
                        height: "18px",
                        cursor: "pointer",
                        accentColor: "#0ea5e9",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Bar */}
        <div
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid var(--line, #e2e8f0)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            Unchecked students are marked Absent automatically.
          </span>
          <button
            className="primary-button"
            type="button"
            onClick={submitAttendance}
            disabled={!selectedClass || isSubmitting || totalStudents === 0}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: "700",
              fontSize: "0.85rem",
              border: 0,
              cursor: "pointer",
            }}
          >
            {isSubmitting ? "Submitting Session..." : `Save Attendance (${presentCount} Present)`}
          </button>
        </div>
      </section>
    </TeacherShell>
  );
}
