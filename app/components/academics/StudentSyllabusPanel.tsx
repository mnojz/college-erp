"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconDownload,
  IconEye,
  IconFileDescription,
  IconFileText,
  IconFilter,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import { formatBytes, resolveTitle, type ProgramsMeta, type SyllabusDto } from "@/app/lib/syllabi-shared";
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

interface Props {
  initialProfile?: Profile | null;
}

export function StudentSyllabusPanel({ initialProfile }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [syllabi, setSyllabi] = useState<SyllabusDto[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({
    departments: [],
    programs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    initialProfile?.program?.id ?? "ALL"
  );
  const [semesterFilter, setSemesterFilter] = useState<"ALL" | number>("ALL");

  useEffect(() => {
    async function load() {
      try {
        const fetchProfile = !initialProfile;
        const [profileRes, listRes, metaRes] = await Promise.all([
          fetchProfile ? fetch("/api/student/profile") : Promise.resolve(null),
          fetch("/api/syllabus"),
          fetch("/api/syllabus/meta"),
        ]);

        if (profileRes) {
          if (profileRes.status === 401 || profileRes.status === 403) {
            router.replace("/dashboard");
            return;
          }
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setProfile(profileData.student);
            if (profileData.student?.program?.id) {
              setSelectedProgramId(profileData.student.program.id);
            }
          }
        }

        if (!listRes.ok) throw new Error("Unable to load syllabus");
        const listData = await listRes.json();
        setSyllabi(listData.syllabi ?? []);

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setMeta({
            departments: metaData.departments ?? [],
            programs: metaData.programs ?? [],
          });
        }
      } catch (err) {
        setError((err as Error).message ?? "Unable to load syllabus");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router, initialProfile]);

  // Filtered syllabus records
  const filteredSyllabi = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return syllabi.filter((s) => {
      // Program filter
      if (selectedProgramId !== "ALL" && s.programId !== selectedProgramId) {
        return false;
      }
      // Semester filter
      if (semesterFilter !== "ALL" && s.semester !== semesterFilter) {
        return false;
      }
      // Search query
      if (q) {
        const haystack = `${s.title ?? ""} ${s.fileName} ${s.departmentName} ${s.programCode ?? ""} ${s.programName ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [syllabi, selectedProgramId, semesterFilter, searchQuery]);

  // Current semester syllabus documents spotlight
  const currentSemesterSyllabi = useMemo(() => {
    if (!profile?.currentSemester) return [];
    const myProgId = profile.program?.id;
    return syllabi.filter(
      (s) =>
        (myProgId ? s.programId === myProgId : true) &&
        s.semester === profile.currentSemester
    );
  }, [syllabi, profile]);

  // Group filtered syllabi by semester (1 to 8)
  const groupedBySemester = useMemo(() => {
    const map = new Map<number, SyllabusDto[]>();
    for (const item of filteredSyllabi) {
      const sem = item.semester;
      const list = map.get(sem) ?? [];
      list.push(item);
      map.set(sem, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filteredSyllabi]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const isFilteredToMyProgram =
    profile?.program?.id && selectedProgramId === profile.program.id;

  return (
    <div className="space-y-4">
      {/* ── Featured Spotlight: Current Semester Syllabus ── */}
      {currentSemesterSyllabi.length > 0 && (
        <Card className="rounded-2xl border border-primary/40 shadow-xs bg-linear-to-r from-primary/10 via-primary/5 to-background p-4 sm:p-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/20 text-primary">
                  <IconSparkles size={14} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Academic Focus
                </span>
              </div>
              <h2 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-foreground">
                Semester {profile?.currentSemester} Official Syllabus
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Official curriculum guideline and evaluation scheme for your current semester.
              </p>
            </div>

            {/* Quick Action Buttons for Spotlight Documents */}
            <div className="flex flex-wrap items-center gap-2">
              {currentSemesterSyllabi.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <Button
                    asChild
                    size="sm"
                    className="h-8 text-xs font-semibold px-3 gap-1.5 shadow-xs"
                  >
                    <a
                      href={`/api/syllabus/${s.id}/file?inline=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconEye size={14} />
                      Preview PDF
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold px-2.5 gap-1.5"
                  >
                    <a href={`/api/syllabus/${s.id}/file`} download>
                      <IconDownload size={14} />
                      Download
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Filter Toolbar ── */}
      <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-48">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search syllabus by title, course, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8.5"
            />
          </div>

          {/* Program Select Filter */}
          <div className="flex items-center gap-2">
            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
              <SelectTrigger className="w-full sm:w-64 h-8.5 text-xs font-medium">
                <IconFilter size={13} className="text-muted-foreground mr-1 shrink-0" />
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                {profile?.program && (
                  <SelectItem value={profile.program.id} className="text-xs font-bold text-primary">
                    My Program ({profile.program.code})
                  </SelectItem>
                )}
                <SelectItem value="ALL" className="text-xs">
                  All College Programs
                </SelectItem>
                {meta.programs.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quick My Program Reset Pill if switched */}
            {profile?.program && !isFilteredToMyProgram && (
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 text-xs font-semibold px-2 shrink-0"
                onClick={() => setSelectedProgramId(profile.program!.id)}
              >
                Reset to My Program
              </Button>
            )}
          </div>
        </div>

        {/* Semester Filter Pills */}
        <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Semester:</span>
          <button
            type="button"
            onClick={() => setSemesterFilter("ALL")}
            className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-colors ${
              semesterFilter === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
            const isCurrent = profile?.currentSemester === sem;
            return (
              <button
                key={sem}
                type="button"
                onClick={() => setSemesterFilter(sem)}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                  semesterFilter === sem
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : isCurrent
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                Sem {sem}
                {isCurrent && <span className="text-[10px]">★</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
          {error}
        </p>
      )}

      {/* ── Grouped Syllabus Cards ── */}
      {groupedBySemester.length === 0 ? (
        <Card className="rounded-xl border-dashed p-10 text-center bg-card/60">
          <IconFileDescription className="size-8 text-muted-foreground/40 mx-auto" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">No syllabus documents found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No files match your selected filters. Try clearing your search query or selecting a different program.
          </p>
          {(searchQuery || semesterFilter !== "ALL" || selectedProgramId !== (profile?.program?.id ?? "ALL")) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs font-medium"
              onClick={() => {
                setSearchQuery("");
                setSemesterFilter("ALL");
                setSelectedProgramId(profile?.program?.id ?? "ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedBySemester.map(([semesterNo, docs]) => {
            const isCurrentSem = profile?.currentSemester === semesterNo;

            return (
              <div key={semesterNo} className="space-y-2.5">
                {/* Semester Header */}
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                    {semesterNo}
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Semester {semesterNo} Curriculum
                  </h3>
                  {isCurrentSem && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold px-1.5 py-0 bg-primary/10 text-primary border-primary/30"
                    >
                      Your Current Semester
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">({docs.length} file{docs.length > 1 ? "s" : ""})</span>
                  <div className="h-px flex-1 bg-border/60 ml-2" />
                </div>

                {/* Cards for Documents in this Semester */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {docs.map((doc) => (
                    <Card
                      key={doc.id}
                      className="rounded-xl border border-border/70 p-3.5 shadow-xs bg-card hover:border-primary/40 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                              <IconFileText size={16} />
                            </span>
                            <div className="min-w-0">
                              <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-muted/50">
                                {doc.programCode ?? "ALL"}
                              </Badge>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                            {formatBytes(doc.fileSize)}
                          </span>
                        </div>

                        <h4
                          className="mt-2 text-xs sm:text-sm font-bold text-foreground line-clamp-1"
                          title={resolveTitle(doc)}
                        >
                          {resolveTitle(doc)}
                        </h4>
                        <p className="mt-0.5 text-[11px] text-muted-foreground truncate" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {doc.departmentName || "Academic Syllabus"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-semibold px-2 hover:bg-muted"
                          >
                            <a
                              href={`/api/syllabus/${doc.id}/file?inline=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <IconEye size={13} className="mr-1" />
                              Preview
                            </a>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-semibold px-2"
                          >
                            <a href={`/api/syllabus/${doc.id}/file`} download>
                              <IconDownload size={13} className="mr-1 text-primary" />
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
