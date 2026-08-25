"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";

type ClassSchedule = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: { id: string; name: string; code: string };
  program: {
    id: string;
    name: string;
    code: string;
    departmentName: string;
  };
  semester: number;
};

type TeacherInfo = {
  firstName: string;
  lastName: string;
  employeeNo: string;
  profileImageUrl: string | null;
};

const weekDays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const dayMap: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export default function TeacherSchedulePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSchedule() {
      try {
        const response = await fetch("/api/teacher/profile");
        if (response.status === 401 || response.status === 403) {
          router.replace("/");
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to load teaching schedule");
          return;
        }

        setClasses(data.teacher?.classes ?? []);
        if (data.teacher) {
          setTeacherInfo({
            firstName: data.teacher.user.firstName,
            lastName: data.teacher.user.lastName,
            employeeNo: data.teacher.employeeNo,
            profileImageUrl: data.teacher.profileImageUrl,
          });
        }
      } catch {
        setError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, [router]);

  if (error) {
    return (
      <main className="profile-error">
        <p>{error}</p>
      </main>
    );
  }

  if (loading) {
    return <main className="profile-loading">Loading teaching schedule...</main>;
  }

  const todayDayName = dayMap[new Date().getDay()];

  // Calculate stats
  const activeDays = new Set(classes.map((c) => c.dayOfWeek)).size;
  const uniqueSubjects = new Set(classes.map((c) => c.subject.code)).size;

  return (
    <TeacherShell
      active="/teacher/schedule"
      title="Weekly Teaching Schedule"
      subtitle="Faculty Timetable & Lectures"
      teacherName={teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : "Faculty Member"}
      employeeNo={teacherInfo?.employeeNo}
      avatarUrl={teacherInfo?.profileImageUrl}
    >
      {/* Metric Cards */}
      <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
        <article className="admin-metric-card">
          <span>Weekly Lecture Sessions</span>
          <strong>{classes.length}</strong>
          <small>Scheduled class slots</small>
        </article>
        <article className="admin-metric-card">
          <span>Teaching Days</span>
          <strong style={{ color: "#0ea5e9" }}>{activeDays} Days</strong>
          <small>Per academic week</small>
        </article>
        <article className="admin-metric-card">
          <span>Unique Subjects</span>
          <strong style={{ color: "#8b5cf6" }}>{uniqueSubjects}</strong>
          <small>Distinct courses taught</small>
        </article>
      </section>

      {/* Schedule by Day */}
      <div style={{ display: "grid", gap: "20px" }}>
        {weekDays.map((day) => {
          const dayClasses = classes.filter((c) => c.dayOfWeek === day);
          const isToday = day === todayDayName;

          return (
            <section
              key={day}
              className="profile-info-card"
              style={{
                padding: "20px 24px",
                borderLeft: isToday ? "4px solid #0ea5e9" : "1px solid var(--line, #e2e8f0)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--line, #e2e8f0)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2 style={{ margin: 0, padding: 0, fontSize: "1.05rem", fontWeight: "700" }}>
                    {day}
                  </h2>
                  {isToday && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "99px",
                        background: "#0ea5e9",
                        color: "#fff",
                        fontSize: "0.72rem",
                        fontWeight: "700",
                      }}
                    >
                      TODAY
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                  {dayClasses.length} {dayClasses.length === 1 ? "Session" : "Sessions"}
                </span>
              </div>

              {dayClasses.length === 0 ? (
                <p style={{ margin: "14px 0 4px", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                  No scheduled classes for {day.toLowerCase()}.
                </p>
              ) : (
                <div style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
                  {dayClasses.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 18px",
                        borderRadius: "10px",
                        border: "1px solid var(--line, #e2e8f0)",
                        background: isToday ? "rgba(14, 165, 233, 0.04)" : "var(--panel, #fff)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            background: "#e0f2fe",
                            color: "#0284c7",
                            fontWeight: "700",
                            fontSize: "0.85rem",
                            textAlign: "center",
                          }}
                        >
                          {item.subject.code}
                        </div>
                        <div>
                          <strong style={{ display: "block", fontSize: "0.95rem" }}>
                            {item.subject.name}
                          </strong>
                          <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                            Program: {item.program.name} ({item.program.code}) · Semester {item.semester}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "#0ea5e9" }}>
                          {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(item.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                          Lecture Hall
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </TeacherShell>
  );
}
