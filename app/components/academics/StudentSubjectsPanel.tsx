"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconBook2,
  IconCalendarCheck,
  IconClock,
  IconFileText,
  IconFilter,
  IconLayoutGrid,
  IconList,
  IconSearch,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: {
    id: string;
    name: string;
    code: string;
    departmentName: string;
    durationYears: number;
  } | null;
};

type Subject = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
  program: { name: string; code: string };
  subjectTeachers: {
    teacher: {
      id: string;
      employeeNo: string;
      user: { firstName: string; lastName: string };
    };
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

interface Props {
  initialProfile?: Profile | null;
}

export function StudentSubjectsPanel({ initialProfile }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSlot[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [semesterChoice, setSemesterChoice] = useState("AUTO");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const fetchProfile = !initialProfile;
        const [profileRes, subjectsRes, classesRes, materialsRes] = await Promise.all([
          fetchProfile ? fetch("/api/student/profile") : Promise.resolve(null),
          fetch("/api/subjects"),
          fetch("/api/classes"),
          fetch("/api/materials"),
        ]);

        if (profileRes) {
          if (profileRes.status === 401 || profileRes.status === 403) {
            router.replace("/dashboard");
            return;
          }
          if (!profileRes.ok) {
            setError("Unable to load student profile");
            return;
          }
          const profileData = await profileRes.json();
          setProfile(profileData.student);
        }

        if (!subjectsRes.ok || !classesRes.ok) {
          setError("Unable to load enrolled subjects");
          return;
        }

        const subjectsData = await subjectsRes.json();
        const classesData = await classesRes.json();

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
  }, [router, initialProfile]);

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

  // Materials count map
  const materialCountBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materials) {
      if (!m.subjectId) continue;
      map.set(m.subjectId, (map.get(m.subjectId) ?? 0) + 1);
    }
    return map;
  }, [materials]);

  // Class sessions count map
  const classesBySubject = useMemo(() => {
    const map = new Map<string, ClassSlot[]>();
    for (const c of classes) {
      const list = map.get(c.subjectId) ?? [];
      list.push(c);
      map.set(c.subjectId, list);
    }
    return map;
  }, [classes]);

  // Filtered subjects by semester & search
  const visibleSubjects = useMemo(() => {
    let list =
      effectiveSemester === "ALL"
        ? programSubjects
        : programSubjects.filter((s) => String(s.semester) === effectiveSemester);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const codeMatch = s.code.toLowerCase().includes(q);
        const nameMatch = s.name.toLowerCase().includes(q);
        const teacherMatch = s.subjectTeachers.some((st) =>
          `${st.teacher.user.firstName} ${st.teacher.user.lastName}`
            .toLowerCase()
            .includes(q),
        );
        return codeMatch || nameMatch || teacherMatch;
      });
    }

    return list;
  }, [programSubjects, effectiveSemester, searchQuery]);

  // Stats calculation
  const visibleStats = useMemo(() => {
    const ids = new Set(visibleSubjects.map((s) => s.id));
    const teacherIds = new Set<string>();
    for (const s of visibleSubjects) {
      for (const st of s.subjectTeachers) teacherIds.add(st.teacher.id);
    }
    return {
      classes: classes.filter((c) => ids.has(c.subjectId)).length,
      faculty: teacherIds.size,
      materials: materials.filter((m) => m.subjectId && ids.has(m.subjectId)).length,
    };
  }, [visibleSubjects, classes, materials]);

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive font-medium">
        {error}
      </p>
    );
  }

  if (loading || !profile) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skeleton className="h-18 w-full rounded-xl" />
          <Skeleton className="h-18 w-full rounded-xl" />
          <Skeleton className="h-18 w-full rounded-xl" />
          <Skeleton className="h-18 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Compact Stat Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Subjects Count */}
        <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Enrolled Subjects</span>
            <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconBook2 size={13} />
            </span>
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {visibleSubjects.length}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {effectiveSemester === "ALL"
              ? `Across ${semesters.length} semesters`
              : `Semester ${effectiveSemester} (${programSubjects.length} total)`}
          </p>
        </Card>

        {/* Card 2: Weekly Classes */}
        <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Weekly Classes</span>
            <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconClock size={13} />
            </span>
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {visibleStats.classes}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            Lectures &amp; practicals
          </p>
        </Card>

        {/* Card 3: Faculty Teaching */}
        <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Course Faculty</span>
            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IconUsers size={13} />
            </span>
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {visibleStats.faculty}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            Assigned professors
          </p>
        </Card>

        {/* Card 4: Study Materials */}
        <Card className="rounded-xl border border-border/70 p-3 shadow-xs bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Study Materials</span>
            <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
              <IconFileText size={13} />
            </span>
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {visibleStats.materials}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            Notes &amp; handouts
          </p>
        </Card>
      </div>

      {/* ── Filter Toolbar ── */}
      <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-48">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by subject code, title, or instructor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8.5"
            />
          </div>

          {/* Controls: Semester Select & View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Select value={semesterChoice} onValueChange={setSemesterChoice}>
              <SelectTrigger className="w-full sm:w-56 h-8.5 text-xs">
                <IconFilter size={13} className="text-muted-foreground mr-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO" className="text-xs">
                  {profile.currentSemester != null
                    ? `Current (Semester ${profile.currentSemester})`
                    : "Current semester"}
                </SelectItem>
                <SelectItem value="ALL" className="text-xs">
                  All semesters
                </SelectItem>
                {semesters.map((sem) => (
                  <SelectItem key={sem} value={String(sem)} className="text-xs">
                    Semester {sem}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid View"
                aria-label="Grid View"
              >
                <IconLayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table View"
                aria-label="Table View"
              >
                <IconList size={14} />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Content View ── */}
      {visibleSubjects.length === 0 ? (
        <Card className="rounded-xl border-dashed p-10 text-center bg-card/60">
          <IconBook2 className="size-8 text-muted-foreground/40 mx-auto" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">No subjects found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No subjects match your current filter
            {effectiveSemester !== "ALL" ? ` for semester ${effectiveSemester}` : ""}.
          </p>
          {(searchQuery || semesterChoice !== "AUTO") && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs font-medium"
              onClick={() => {
                setSearchQuery("");
                setSemesterChoice("AUTO");
              }}
            >
              Reset Filters
            </Button>
          )}
        </Card>
      ) : viewMode === "grid" ? (
        /* ──── GRID CARDS VIEW ──── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {visibleSubjects.map((sub) => {
            const materialCount = materialCountBySubject.get(sub.id) ?? 0;
            const subClasses = classesBySubject.get(sub.id) ?? [];
            const isCurrentSem =
              profile.currentSemester != null && sub.semester === profile.currentSemester;

            return (
              <Card
                key={sub.id}
                className="rounded-xl border border-border/70 p-4 shadow-xs bg-card hover:border-primary/40 transition-colors flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Code & Semester Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-xs font-bold bg-muted/60">
                      {sub.code}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        Sem {sub.semester}
                      </Badge>
                      {isCurrentSem && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-primary text-[10px] font-bold"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Subject Name */}
                  <h3
                    className="mt-2.5 text-sm font-bold tracking-tight text-foreground line-clamp-2"
                    title={sub.name}
                  >
                    {sub.name}
                  </h3>

                  {/* Faculty Assigned */}
                  <div className="mt-3 pt-2.5 border-t border-border/50 text-xs">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <IconUser size={13} className="text-primary/70 shrink-0" />
                      {sub.subjectTeachers.length > 0 ? (
                        <span className="font-semibold text-foreground truncate">
                          {sub.subjectTeachers
                            .map((st) => `${st.teacher.user.firstName} ${st.teacher.user.lastName}`)
                            .join(", ")}
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground/70">Instructor unassigned</span>
                      )}
                    </span>
                  </div>

                  {/* Schedule Sessions */}
                  <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                    <IconClock size={13} className="text-muted-foreground/70 shrink-0" />
                    <span>
                      {subClasses.length > 0
                        ? `${subClasses.length} session${subClasses.length > 1 ? "s" : ""} / week`
                        : "No weekly slots configured"}
                    </span>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  {materialCount > 0 ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-semibold px-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <Link href={`/student/notes?subjectId=${sub.id}`}>
                        <IconFileText size={13} className="mr-1" />
                        {materialCount} Note{materialCount > 1 ? "s" : ""}
                        <IconArrowRight size={12} className="ml-1" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/60 italic">
                      No materials yet
                    </span>
                  )}

                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs font-semibold px-2 text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/student/attendance">
                      <IconCalendarCheck size={13} className="mr-1" />
                      Attendance
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ──── TABLE VIEW ──── */
        <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-28 text-xs font-bold uppercase tracking-wider py-2.5">Code</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5">Subject</TableHead>
                  <TableHead className="w-28 text-xs font-bold uppercase tracking-wider py-2.5">Semester</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5">Faculty</TableHead>
                  <TableHead className="w-32 text-xs font-bold uppercase tracking-wider py-2.5">Sessions</TableHead>
                  <TableHead className="w-40 text-right pr-4 text-xs font-bold uppercase tracking-wider py-2.5">Resources</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSubjects.map((sub) => {
                  const materialCount = materialCountBySubject.get(sub.id) ?? 0;
                  const subClasses = classesBySubject.get(sub.id) ?? [];
                  const isCurrentSem =
                    profile.currentSemester != null && sub.semester === profile.currentSemester;

                  return (
                    <TableRow key={sub.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-2.5 font-mono text-xs font-bold">
                        <Badge variant="outline" className="font-mono text-xs font-bold bg-muted/60">
                          {sub.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 font-medium text-xs text-foreground">
                        <span className="font-semibold">{sub.name}</span>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>Semester {sub.semester}</span>
                          {isCurrentSem && (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 text-primary text-[10px] font-bold py-0 px-1.5"
                            >
                              Current
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {sub.subjectTeachers.length > 0 ? (
                          <span className="font-medium text-foreground">
                            {sub.subjectTeachers
                              .map((st) => `${st.teacher.user.firstName} ${st.teacher.user.lastName}`)
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {subClasses.length > 0 ? (
                          <span>{subClasses.length} / week</span>
                        ) : (
                          <span className="italic text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 text-right pr-4">
                        {materialCount > 0 ? (
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs font-semibold px-2">
                            <Link href={`/student/notes?subjectId=${sub.id}`}>
                              <IconFileText size={13} className="mr-1 text-emerald-500" />
                              {materialCount} Notes
                              <IconArrowRight size={12} className="ml-1" />
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60 italic">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
