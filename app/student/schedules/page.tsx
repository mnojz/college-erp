"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { TimetableGrid, type TimetableItem } from "@/app/components/timetable/TimetableGrid";
import { IconUsers, IconRosetteDiscountCheck } from "@tabler/icons-react";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string; durationYears: number } | null;
};

type ProgramOption = { id: string; name: string; code: string; durationYears: number };

type ClassRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type?: string | null;
  group?: string | null;
  semester: number;
  programId: string;
  subject: { name: string; code: string };
  teacher: { employeeNo: string; user: { firstName: string; lastName: string } } | null;
};

const ttInput: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid var(--line)",
  borderRadius: "8px",
  background: "var(--input-bg)",
  color: "var(--input-color, inherit)",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
};

export default function StudentSchedulesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, programsRes, classesRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/programs"),
          fetch("/api/classes"),
        ]);

        if (!profileRes.ok || !programsRes.ok || !classesRes.ok) {
          router.replace("/dashboard");
          return;
        }

        const profileData = await profileRes.json();
        const programsData = await programsRes.json();
        const classesData = await classesRes.json();

        const p: Profile = profileData.student;
        setProfile(p);
        setPrograms((programsData.programs ?? []) as ProgramOption[]);
        setClasses((classesData.classes ?? []) as ClassRow[]);

        // Default to the student's own routine.
        const programId = p.program?.id ?? "";
        setSelectedProgramId(programId);
        setSelectedSemester(String(p.currentSemester ?? 1));
      } catch {
        setError("Unable to load class timetable");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;
  const semesterCount = selectedProgram ? selectedProgram.durationYears * 2 : 0;

  const items: TimetableItem[] = useMemo(
    () =>
      classes
        .filter(
          (c) =>
            c.programId === selectedProgramId &&
            c.semester === Number(selectedSemester),
        )
        .map((c) => ({
          id: c.id,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          endTime: c.endTime,
          type: c.type,
          group: c.group,
          subject: c.subject,
          subjectTeacherName: c.teacher
            ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}`
            : undefined,
        })),
    [classes, selectedProgramId, selectedSemester],
  );

  const isOwnRoutine =
    !!profile?.program &&
    profile.program.id === selectedProgramId &&
    profile.currentSemester === Number(selectedSemester);

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading timetable...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

  return (
    <StudentShell
      active="/student/schedules"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Class Schedules & Timetable"
      subtitle="Weekly Routine"
    >
      <div style={{ display: "grid", gap: "20px" }}>
        {/* Toolbar: pick any program + semester (read-only view). */}
        <section
          style={{
            padding: "18px 20px",
            borderRadius: "12px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            alignItems: "flex-end",
          }}
        >
          <label style={{ display: "grid", gap: "6px", minWidth: "260px", flex: 1 }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
              Program
            </span>
            <select
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedSemester("");
              }}
              style={ttInput}
              disabled={programs.length === 0}
            >
              {programs.length === 0 && <option value="">No programs</option>}
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", width: "180px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)" }}>
              Semester
            </span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              style={ttInput}
              disabled={!selectedProgramId}
            >
              <option value="">Select semester</option>
              {Array.from({ length: semesterCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  Semester {n}
                </option>
              ))}
            </select>
          </label>

          {isOwnRoutine ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#0369a1",
                background: "#e0f2fe",
                borderRadius: "99px",
                padding: "8px 14px",
              }}
            >
              <IconRosetteDiscountCheck size={15} aria-hidden="true" />
              Your routine
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink-soft)",
                borderRadius: "99px",
                padding: "8px 14px",
                border: "1px solid var(--line)",
              }}
            >
              <IconUsers size={15} aria-hidden="true" />
              Viewing a public routine
            </span>
          )}
        </section>

        {/* Read-only weekly grid — same visual as the admin timetable editor. */}
        {selectedProgramId && selectedSemester ? (
          <section
            style={{
              padding: "18px 20px",
              borderRadius: "12px",
              background: "var(--panel)",
              border: "1px solid var(--line)",
            }}
          >
            <TimetableGrid items={items} readonly />
            {items.length === 0 && (
              <p
                style={{
                  margin: "14px 0 0",
                  padding: "14px",
                  fontSize: "13px",
                  color: "var(--ink-soft)",
                  textAlign: "center",
                  border: "1px dashed var(--line)",
                  borderRadius: "10px",
                }}
              >
                No classes scheduled for {selectedProgram?.code} · Semester {selectedSemester} yet.
              </p>
            )}
          </section>
        ) : (
          <div className="cs-empty">Pick a program and semester to view its weekly timetable.</div>
        )}
      </div>
    </StudentShell>
  );
}
