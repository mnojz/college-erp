"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowRight, IconFileText } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  rollNumber: number | null;
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

export function StudentSubjectsPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSlot[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [semesterChoice, setSemesterChoice] = useState("AUTO");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, subjectsRes, classesRes, materialsRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/subjects"),
          fetch("/api/classes"),
          fetch("/api/materials"),
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
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (loading || !profile) {
    return <Skeleton className="h-40 w-full" />;
  }

  const program = profile.program;

  return (
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

        {/* One row per subject: code · name · semester · materials action. */}
        {visibleSubjects.length === 0 ? (
          <div className="rounded-md border bg-muted/40 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No subjects found
              {effectiveSemester !== "ALL" ? ` for semester ${effectiveSemester}` : " for this program"}.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-32">Semester</TableHead>
                  <TableHead className="w-48 text-right">Study Materials</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSubjects.map((sub) => {
                  const hasMaterials = (materialCountBySubject.get(sub.id) ?? 0) > 0;
                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                          {sub.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[46ch] truncate font-medium" title={sub.name}>
                          {sub.name}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        Semester {sub.semester}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasMaterials ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/student/notes?subjectId=${sub.id}`}>
                              <IconFileText size={15} stroke={1.8} aria-hidden="true" />
                              Study Materials
                              <IconArrowRight size={14} stroke={1.8} aria-hidden="true" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title="No study materials have been uploaded for this subject yet"
                          >
                            <IconFileText size={15} stroke={1.8} aria-hidden="true" />
                            Study Materials
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
