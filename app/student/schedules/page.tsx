"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { TimetableGrid, type TimetableItem } from "@/app/components/timetable/TimetableGrid";
import { IconUsers, IconRosetteDiscountCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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

type BreakRow = { id: string; programId: string; semester: number; startTime: string; endTime: string };

export default function StudentSchedulesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, programsRes, classesRes, breaksRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/programs"),
          fetch("/api/classes"),
          fetch("/api/breaks"),
        ]);

        if (!profileRes.ok || !programsRes.ok || !classesRes.ok || !breaksRes.ok) {
          router.replace("/dashboard");
          return;
        }

        const profileData = await profileRes.json();
        const programsData = await programsRes.json();
        const classesData = await classesRes.json();
        const breaksData = await breaksRes.json();

        const p: Profile = profileData.student;
        setProfile(p);
        setPrograms((programsData.programs ?? []) as ProgramOption[]);
        setClasses((classesData.classes ?? []) as ClassRow[]);
        setBreaks((breaksData.breaks ?? []) as BreakRow[]);

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

  const breakPeriod = useMemo(() => {
    const match = breaks.find(
      (b) => b.programId === selectedProgramId && String(b.semester) === selectedSemester,
    );
    return match ? { start: match.startTime, end: match.endTime } : null;
  }, [breaks, selectedProgramId, selectedSemester]);

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

  if (error) {
    return (
      <StudentShell title="Class Schedules & Timetable" active="/student/schedules">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      </StudentShell>
    );
  }
  if (loading || !profile) {
    return (
      <StudentShell title="Class Schedules & Timetable" active="/student/schedules">
        <Skeleton className="h-40 w-full" />
      </StudentShell>
    );
  }

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
      <div className="flex flex-col gap-5">
        {/* Toolbar: pick any program + semester (read-only view). */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 p-4">
            <div className="grid min-w-60 flex-1 gap-1.5">
              <Label>Program</Label>
              <Select
                value={selectedProgramId || undefined}
                onValueChange={(value) => {
                  setSelectedProgramId(value);
                  setSelectedSemester("");
                }}
                disabled={programs.length === 0}
              >
                <SelectTrigger aria-label="Program">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-44 gap-1.5">
              <Label>Semester</Label>
              <Select
                value={selectedSemester || undefined}
                onValueChange={setSelectedSemester}
                disabled={!selectedProgramId}
              >
                <SelectTrigger aria-label="Semester">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: semesterCount }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Semester {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isOwnRoutine ? (
              <Badge className="gap-1.5 bg-sky-500/10 px-3 py-1.5 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300">
                <IconRosetteDiscountCheck size={15} aria-hidden="true" />
                Your routine
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                <IconUsers size={15} aria-hidden="true" />
                Viewing a public routine
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Read-only weekly grid — same visual as the admin timetable editor. */}
        {selectedProgramId && selectedSemester ? (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <TimetableGrid items={items} breakPeriod={breakPeriod} readonly />
              {items.length === 0 && (
                <p className="mt-4 rounded-md border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
                  No classes scheduled for {selectedProgram?.code} · Semester {selectedSemester} yet.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <p className="rounded-md border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            Pick a program and semester to view its weekly timetable.
          </p>
        )}
      </div>
    </StudentShell>
  );
}
