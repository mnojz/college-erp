"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { IconClock, IconUser } from "@tabler/icons-react";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string } | null;
};

type ClassSchedule = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  programId: string;
  subject: { name: string; code: string };
  semester: number;
  teacher: { employeeNo: string; user: { firstName: string; lastName: string } };
};

const DAYS_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function formatTime(isoTime: string) {
  try {
    const d = new Date(isoTime);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return isoTime;
  }
}

export default function StudentSchedulesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, classesRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/classes"),
        ]);

        if (!profileRes.ok || !classesRes.ok) {
          router.replace("/");
          return;
        }

        const profileData = await profileRes.json();
        const classesData = await classesRes.json();

        setProfile(profileData.student);

        const allClasses: ClassSchedule[] = classesData.classes ?? [];
        const programClasses = profileData.student?.program?.id
          ? allClasses.filter((c) => c.programId === profileData.student.program.id)
          : allClasses;

        setClasses(programClasses);
      } catch {
        setError("Unable to load class timetable");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading timetable...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

  // Group classes by day of week
  const groupedByDay = DAYS_ORDER.reduce<Record<string, ClassSchedule[]>>((acc, day) => {
    const dayClasses = classes.filter((c) => c.dayOfWeek === day);
    if (dayClasses.length > 0) {
      acc[day] = dayClasses;
    }
    return acc;
  }, {});

  const activeDays = Object.keys(groupedByDay);

  return (
    <StudentShell
      active="/student/schedules"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Class Schedules & Timetable"
      subtitle="Weekly Routine"
    >

          <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
            <article className="admin-metric-card">
              <span>Weekly Lectures</span>
              <strong>{classes.length}</strong>
              <small>Scheduled sessions</small>
            </article>
            <article className="admin-metric-card">
              <span>Active Days</span>
              <strong>{activeDays.length}</strong>
              <small>Days with classes</small>
            </article>
            <article className="admin-metric-card">
              <span>Program</span>
              <strong style={{ fontSize: "1.4rem" }}>{profile.program?.code ?? "N/A"}</strong>
              <small>{profile.program?.name ?? "Academic stream"}</small>
            </article>
          </section>

          {activeDays.length === 0 ? (
            <div className="profile-info-card" style={{ padding: "32px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--ink-soft)" }}>
                No active timetable scheduled for this program yet.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "20px" }}>
              {activeDays.map((day) => (
                <div key={day} className="profile-info-card" style={{ padding: "20px" }}>
                  <h2
                    style={{
                      padding: "0 0 12px 0",
                      fontSize: "1.05rem",
                      fontWeight: "700",
                      color: "var(--foreground)",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    {day}
                  </h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "14px",
                      marginTop: "14px",
                    }}
                  >
                    {groupedByDay[day].map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: "14px",
                          borderRadius: "10px",
                          border: "1px solid var(--line)",
                          background: "#f8fafc",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "6px",
                          }}
                        >
                          <span className="eyebrow" style={{ fontSize: "0.68rem" }}>
                            {item.subject.code}
                          </span>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: "#e0f2fe",
                              color: "#0369a1",
                              fontWeight: "600",
                            }}
                          >
                            Sem {item.semester}
                          </span>
                        </div>
                        <h4 style={{ margin: "4px 0 8px", fontSize: "0.95rem", fontWeight: "600" }}>
                          {item.subject.name}
                        </h4>
                        <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                          <p style={{ margin: "2px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                            <IconClock size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                            {formatTime(item.startTime)} — {formatTime(item.endTime)}
                          </p>
                          <p style={{ margin: "2px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                            <IconUser size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                            Prof. {item.teacher.user.firstName} {item.teacher.user.lastName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
    </StudentShell>
  );
}
