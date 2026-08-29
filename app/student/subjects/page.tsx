"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconClock,
  IconFileText,
  IconNotes,
  IconSpeakerphone,
  IconUser,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string; departmentName: string; durationYears: number } | null;
};

type Subject = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
  program: { name: string; code: string };
  subjectTeachers: {
    teacher: { id: string; employeeNo: string; user: { firstName: string; lastName: string } };
  }[];
};

type ClassSlot = {
  id: string;
  subjectId: string;
  dayOfWeek: string;
  startTime: string;
  type: string | null;
};

type MaterialRow = { id: string; subjectId: string | null };
type NoticeRow = { id: string; subject: { id: string } | null };

const DAYS_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function dayLabel(day: string) {
  return day.charAt(0) + day.slice(1, 3).toLowerCase(); // "MONDAY" -> "Mon"
}

function formatTime(isoTime: string) {
  try {
    const d = new Date(isoTime);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return isoTime;
  }
}

type SlotSummary = { lecture: number; practical: number; slots: ClassSlot[] };

export default function StudentSubjectsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSlot[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [semesterChoice, setSemesterChoice] = useState("AUTO");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, subjectsRes, classesRes, materialsRes, noticesRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/subjects"),
          fetch("/api/classes"),
          fetch("/api/materials"),
          fetch("/api/announcements"),
        ]);

        if (profileRes.status === 401 || profileRes.status === 403) {
          router.replace("/");
          return;
        }
        if (!profileRes.ok || !subjectsRes.ok || !classesRes.ok) {
          setError("Unable to load enrolled subjects");
          return;
        }

        const profileData = await profileRes.json();
        const subjectsData = await subjectsRes.json();
        const classesData = await classesRes.json();

        setProfile(profileData.student);
        setSubjects(subjectsData.subjects ?? []);
        setClasses(classesData.classes ?? []);

        // Non-critical extras: per-subject material and notice counts.
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json();
          setMaterials(materialsData.materials ?? []);
        }
        if (noticesRes.ok) {
          const noticesData = await noticesRes.json();
          setNotices(noticesData.announcements ?? []);
        }
      } catch {
        setError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  /** Subjects belonging to the student's program. */
  const programSubjects = useMemo(() => {
    const programId = profile?.program?.id;
    if (!programId) return subjects;
    return subjects.filter((s) => s.programId === programId);
  }, [subjects, profile]);

  const semesters = useMemo(
    () => Array.from(new Set(programSubjects.map((s) => s.semester))).sort((a, b) => a - b),
    [programSubjects],
  );

  /** Defaults to the student's current semester; switchable to any other. */
  const effectiveSemester =
    semesterChoice === "AUTO"
      ? profile?.currentSemester != null
        ? String(profile.currentSemester)
        : "ALL"
      : semesterChoice;

  const visibleSubjects = useMemo(
    () =>
      effectiveSemester === "ALL"
        ? programSubjects
        : programSubjects.filter((s) => String(s.semester) === effectiveSemester),
    [programSubjects, effectiveSemester],
  );

  /** Timetable slots per subject, sorted by day then time. */
  const slotsBySubject = useMemo(() => {
    const map = new Map<string, SlotSummary>();
    for (const c of classes) {
      const entry = map.get(c.subjectId) ?? { lecture: 0, practical: 0, slots: [] };
      if ((c.type ?? "Lecture") === "Practical") entry.practical += 1;
      else entry.lecture += 1;
      entry.slots.push(c);
      map.set(c.subjectId, entry);
    }
    for (const entry of map.values()) {
      entry.slots.sort(
        (a, b) =>
          DAYS_ORDER.indexOf(a.dayOfWeek) - DAYS_ORDER.indexOf(b.dayOfWeek) ||
          a.startTime.localeCompare(b.startTime),
      );
    }
    return map;
  }, [classes]);

  const materialCountBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materials) {
      if (!m.subjectId) continue;
      map.set(m.subjectId, (map.get(m.subjectId) ?? 0) + 1);
    }
    return map;
  }, [materials]);

  /** Teacher-scoped notices carry a subject; campus-wide bulletins do not. */
  const noticeCountBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notices) {
      if (!n.subject?.id) continue;
      map.set(n.subject.id, (map.get(n.subject.id) ?? 0) + 1);
    }
    return map;
  }, [notices]);

  const visibleStats = useMemo(() => {
    const ids = new Set(visibleSubjects.map((s) => s.id));
    const teacherIds = new Set<string>();
    for (const s of visibleSubjects) {
      for (const st of s.subjectTeachers) teacherIds.add(st.teacher.id);
    }
    return {
      weeklyClasses: classes.filter((c) => ids.has(c.subjectId)).length,
      faculty: teacherIds.size,
      materials: materials.filter((m) => m.subjectId && ids.has(m.subjectId)).length,
    };
  }, [visibleSubjects, classes, materials]);

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading subjects...</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;
  const program = profile.program;

  return (
    <StudentShell
      active="/student/subjects"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="My Subjects"
      subtitle={program ? `${program.code} — ${program.name}` : "Curriculum & Coursework"}
    >
      <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
        <article className="admin-metric-card">
          <span>Subjects</span>
          <strong>{visibleSubjects.length}</strong>
          <small>
            {effectiveSemester === "ALL"
              ? `Across ${semesters.length} semesters of ${program?.code ?? "program"}`
              : `Semester ${effectiveSemester} · ${programSubjects.length} in program`}
          </small>
        </article>
        <article className="admin-metric-card">
          <span>Weekly Classes</span>
          <strong>{visibleStats.weeklyClasses}</strong>
          <small>Lectures + practicals</small>
        </article>
        <article className="admin-metric-card">
          <span>Faculty Teaching</span>
          <strong>{visibleStats.faculty}</strong>
          <small>Assigned teachers</small>
        </article>
        <article className="admin-metric-card">
          <span>Study Materials</span>
          <strong>{visibleStats.materials}</strong>
          <small>Shared for these subjects</small>
        </article>
      </section>

      <div className="subj-hub-toolbar">
        <label htmlFor="semester-filter">Semester</label>
        <select
          id="semester-filter"
          value={semesterChoice}
          onChange={(e) => setSemesterChoice(e.target.value)}
        >
          <option value="AUTO">
            {profile.currentSemester != null
              ? `Current (Semester ${profile.currentSemester})`
              : "Current semester"}
          </option>
          <option value="ALL">All semesters</option>
          {semesters.map((sem) => (
            <option key={sem} value={String(sem)}>
              Semester {sem}
            </option>
          ))}
        </select>
      </div>

      {visibleSubjects.length === 0 ? (
        <div className="profile-info-card" style={{ padding: "32px", textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            No subjects found
            {effectiveSemester !== "ALL" ? ` for semester ${effectiveSemester}` : " for this program"}.
          </p>
        </div>
      ) : (
        <div className="subj-hub-grid">
          {visibleSubjects.map((sub) => {
            const slots = slotsBySubject.get(sub.id);
            const materialCount = materialCountBySubject.get(sub.id) ?? 0;
            const noticeCount = noticeCountBySubject.get(sub.id) ?? 0;
            const teachers = sub.subjectTeachers.map(
              (st) => `${st.teacher.user.firstName} ${st.teacher.user.lastName}`,
            );
            const slotParts = (slots?.slots ?? [])
              .slice(0, 2)
              .map((s) => `${dayLabel(s.dayOfWeek)} ${formatTime(s.startTime)}`);

            return (
              <article key={sub.id} className="subj-hub-card">
                <div className="subj-hub-top">
                  <span className="eyebrow">{sub.code}</span>
                  <span className="badge badge-violet">Semester {sub.semester}</span>
                </div>
                <h3 className="subj-hub-name">{sub.name}</h3>
                <hr className="subj-hub-divider" />
                <div className="subj-hub-meta">
                  <div className="subj-hub-row">
                    <IconUser size={16} stroke={1.8} />
                    <span>
                      {teachers.length > 0 ? (
                        <strong>{teachers.join(", ")}</strong>
                      ) : (
                        "Teacher not assigned yet"
                      )}
                    </span>
                  </div>
                  <div className="subj-hub-row">
                    <IconClock size={16} stroke={1.8} />
                    <span>
                      {slots && slots.slots.length > 0 ? (
                        <>
                          <strong>
                            {slots.lecture} lecture{slots.lecture === 1 ? "" : "s"}
                            {slots.practical > 0
                              ? ` · ${slots.practical} practical${slots.practical === 1 ? "" : "s"}`
                              : ""}
                          </strong>{" "}
                          weekly
                          {slotParts.length > 0 ? ` — ${slotParts.join(", ")}` : ""}
                        </>
                      ) : (
                        "No timetable slots yet"
                      )}
                    </span>
                  </div>
                </div>
                <div className="subj-hub-chips">
                  {materialCount > 0 ? (
                    <span className="badge badge-blue">
                      <IconNotes size={13} stroke={1.8} /> {materialCount} material
                      {materialCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="badge badge-slate">
                      <IconNotes size={13} stroke={1.8} /> No materials yet
                    </span>
                  )}
                  {noticeCount > 0 ? (
                    <span className="badge badge-green">
                      <IconSpeakerphone size={13} stroke={1.8} /> {noticeCount} notice
                      {noticeCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="badge badge-slate">
                      <IconSpeakerphone size={13} stroke={1.8} /> No notices
                    </span>
                  )}
                </div>
                <div className="subj-hub-links">
                  <Link className="subj-hub-link" href={`/student/notes?subjectId=${sub.id}`}>
                    <IconFileText size={15} stroke={1.8} /> Study materials
                    <IconArrowRight size={14} stroke={1.8} />
                  </Link>
                  <Link className="subj-hub-link" href="/student/schedules">
                    <IconCalendarEvent size={15} stroke={1.8} /> Timetable
                    <IconArrowRight size={14} stroke={1.8} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}

