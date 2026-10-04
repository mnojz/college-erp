"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconFileText,
  IconNotes,
  IconSpeakerphone,
  IconUser,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          router.replace("/dashboard");
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

  const programSubjects = useMemo(() => {
    const programId = profile?.program?.id;
    if (!programId) return subjects;
    return subjects.filter((s) => s.programId === programId);
  }, [subjects, profile]);

  const semesters = useMemo(
    () => Array.from(new Set(programSubjects.map((s) => s.semester))).sort((a, b) => a - b),
    [programSubjects],
  );

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

  const materialCountBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materials) {
      if (!m.subjectId) continue;
      map.set(m.subjectId, (map.get(m.subjectId) ?? 0) + 1);
    }
    return map;
  }, [materials]);

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
      Classes: classes.filter((c) => ids.has(c.subjectId)).length,
      faculty: teacherIds.size,
      materials: materials.filter((m) => m.subjectId && ids.has(m.subjectId)).length,
    };
  }, [visibleSubjects, classes, materials]);

  if (error) {
    return (
      <StudentShell title="My Subjects" active="/student/subjects">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      </StudentShell>
    );
  }
  if (loading || !profile) {
    return (
      <StudentShell title="My Subjects" active="/student/subjects">
        <Skeleton className="h-40 w-full" />
      </StudentShell>
    );
  }

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
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Subjects</p>
              <p className="mt-1 text-3xl font-bold">{visibleSubjects.length}</p>
              <small className="text-xs text-muted-foreground">
                {effectiveSemester === "ALL"
                  ? `Across ${semesters.length} semesters of ${program?.code ?? "program"}`
                  : `Semester ${effectiveSemester} · ${programSubjects.length} in program`}
              </small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Weekly Classes</p>
              <p className="mt-1 text-3xl font-bold">{visibleStats.Classes}</p>
              <small className="text-xs text-muted-foreground">Lectures + practicals</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Faculty Teaching</p>
              <p className="mt-1 text-3xl font-bold">{visibleStats.faculty}</p>
              <small className="text-xs text-muted-foreground">Assigned teachers</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Study Materials</p>
              <p className="mt-1 text-3xl font-bold">{visibleStats.materials}</p>
              <small className="text-xs text-muted-foreground">Shared for these subjects</small>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Semester</span>
          <Select value={semesterChoice} onValueChange={setSemesterChoice}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO">
                {profile.currentSemester != null
                  ? `Current (Semester ${profile.currentSemester})`
                  : "Current semester"}
              </SelectItem>
              <SelectItem value="ALL">All semesters</SelectItem>
              {semesters.map((sem) => (
                <SelectItem key={sem} value={String(sem)}>
                  Semester {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visibleSubjects.length === 0 ? (
          <div className="rounded-md border bg-muted/40 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No subjects found
              {effectiveSemester !== "ALL" ? ` for semester ${effectiveSemester}` : " for this program"}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleSubjects.map((sub) => {
              const materialCount = materialCountBySubject.get(sub.id) ?? 0;
              const noticeCount = noticeCountBySubject.get(sub.id) ?? 0;
              const teachers = sub.subjectTeachers.map(
                (st) => `${st.teacher.user.firstName} ${st.teacher.user.lastName}`,
              );

              return (
                <Card key={sub.id} className="flex h-full flex-col">
                  <CardContent className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                        {sub.code}
                      </span>
                      <Badge variant="secondary">Semester {sub.semester}</Badge>
                    </div>
                    <h3 className="mb-3 text-base font-semibold">{sub.name}</h3>

                    <div className="mb-3 text-sm">
                      <div className="flex items-start gap-2">
                        <IconUser size={16} stroke={1.8} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0">
                          {teachers.length > 0 ? (
                            <strong>{teachers.join(", ")}</strong>
                          ) : (
                            "Teacher not assigned yet"
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {materialCount > 0 ? (
                        <Badge variant="outline" className="gap-1 border-[color-mix(in_oklab,var(--ctp-sky)_45%,transparent)] bg-[color-mix(in_oklab,var(--ctp-sky)_15%,transparent)] text-[var(--ctp-sky)]">
                          <IconNotes size={13} stroke={1.8} aria-hidden="true" /> {materialCount} material{materialCount === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <IconNotes size={13} stroke={1.8} aria-hidden="true" /> No materials yet
                        </Badge>
                      )}
                      {noticeCount > 0 ? (
                        <Badge variant="outline" className="gap-1 border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <IconSpeakerphone size={13} stroke={1.8} aria-hidden="true" /> {noticeCount} notice{noticeCount === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <IconSpeakerphone size={13} stroke={1.8} aria-hidden="true" /> No notices
                        </Badge>
                      )}
                    </div>

                    <div className="mt-auto border-t pt-2.5">
                      <Link
                        href={`/student/notes?subjectId=${sub.id}`}
                        className="flex items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <IconFileText size={15} stroke={1.8} aria-hidden="true" /> Study materials
                        <IconArrowRight size={14} stroke={1.8} className="ml-auto" aria-hidden="true" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
