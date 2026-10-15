"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBook2,
  IconCheck,
  IconChevronRight,
  IconFileText,
  IconFolder,
  IconSearch,
  IconSparkles,
  IconStar,
  IconStarFilled,
  IconX,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { MaterialCard } from "@/app/components/materials/MaterialCard";
import { MaterialPreviewModal } from "@/app/components/materials/MaterialPreviewModal";
import {
  MATERIAL_TYPES,
  rememberRecentMaterial,
  type ProgramsMeta,
  type StudyMaterialDto,
} from "@/app/lib/materials-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string; departmentName: string } | null;
};

type Subject = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
};

type SelectionMode = "MY_SUBJECTS" | "ALL" | "BOOKMARKED" | "SUBJECT";

export default function StudentNotesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [materials, setMaterials] = useState<StudyMaterialDto[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({
    departments: [],
    programs: [],
    subjects: [],
    teachers: [],
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("MY_SUBJECTS");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [details, setDetails] = useState<StudyMaterialDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch("/api/student/profile");
        if (profileRes.status === 401 || profileRes.status === 403) {
          router.replace("/dashboard");
          return;
        }
        const [materialsRes, metaRes, subjectsRes] = await Promise.all([
          fetch("/api/materials"),
          fetch("/api/materials/meta"),
          fetch("/api/subjects"),
        ]);
        if (!materialsRes.ok || !metaRes.ok || !subjectsRes.ok) {
          setError("Unable to load study materials");
          return;
        }
        const profileData = await profileRes.json();
        const materialsData = await materialsRes.json();
        const metaData = await metaRes.json();
        const subjectsData = await subjectsRes.json();

        setProfile(profileData.student);
        setMaterials(materialsData.materials ?? []);
        setMeta({
          departments: metaData.departments ?? [],
          programs: metaData.programs ?? [],
          subjects: metaData.subjects ?? [],
          teachers: metaData.teachers ?? [],
        });
        setSubjects(subjectsData.subjects ?? []);

        // Check if navigated with a specific subjectId
        const subjectParam = new URLSearchParams(window.location.search).get("subjectId");
        if (
          subjectParam &&
          (subjectsData.subjects ?? []).some((s: { id: string }) => s.id === subjectParam)
        ) {
          setSelectedSubjectId(subjectParam);
          setSelectionMode("SUBJECT");
        }
      } catch {
        setError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const myProgramId = profile?.program?.id ?? null;
  const mySemester = profile?.currentSemester ?? null;

  const mySubjectIds = useMemo(() => {
    if (!myProgramId || !mySemester) return new Set<string>();
    return new Set(
      subjects
        .filter((s) => s.programId === myProgramId && s.semester === mySemester)
        .map((s) => s.id),
    );
  }, [subjects, myProgramId, mySemester]);

  function matchesMySubjects(m: StudyMaterialDto): boolean {
    if (m.subjectId && mySubjectIds.has(m.subjectId)) return true;
    if (!m.subjectId && m.programId && m.programId === myProgramId && m.semester != null) {
      return m.semester === mySemester;
    }
    return false;
  }

  // Enrolled subjects for student's current semester
  const enrolledSubjects = useMemo(() => {
    if (!myProgramId || !mySemester) return [];
    return subjects
      .filter((s) => s.programId === myProgramId && s.semester === mySemester)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [subjects, myProgramId, mySemester]);

  // Count materials per subject
  const subjectMaterialCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materials) {
      const sId = m.subject?.id ?? m.subjectId;
      if (sId) {
        map.set(sId, (map.get(sId) ?? 0) + 1);
      }
    }
    return map;
  }, [materials]);

  // Counts for quick collections
  const mySubjectsCount = useMemo(
    () => materials.filter(matchesMySubjects).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materials, mySubjectIds, myProgramId, mySemester],
  );
  const bookmarkedCount = useMemo(
    () => materials.filter((m) => m.bookmarked).length,
    [materials],
  );

  // Active collection base materials
  const collectionMaterials = useMemo(() => {
    if (selectionMode === "SUBJECT" && selectedSubjectId) {
      return materials.filter(
        (m) => (m.subject?.id ?? m.subjectId) === selectedSubjectId,
      );
    }
    if (selectionMode === "MY_SUBJECTS") {
      return materials.filter(matchesMySubjects);
    }
    if (selectionMode === "BOOKMARKED") {
      return materials.filter((m) => m.bookmarked);
    }
    return materials;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionMode, selectedSubjectId, materials, mySubjectIds, myProgramId, mySemester]);

  // Available types inside the active collection for the type pills
  const availableTypes = useMemo(() => {
    const typesInCollection = new Set(collectionMaterials.map((m) => m.materialType));
    return MATERIAL_TYPES.filter((t) => typesInCollection.has(t.value as any));
  }, [collectionMaterials]);

  // Final filtered list with type filter and search query applied
  const filteredMaterials = useMemo(() => {
    let list = collectionMaterials;

    if (selectedType !== "ALL") {
      list = list.filter((m) => m.materialType === selectedType);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const haystack = [
          m.title,
          m.description ?? "",
          m.topic ?? "",
          m.subject?.name ?? "",
          m.subject?.code ?? "",
          m.fileName,
          m.uploader.name,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return list;
  }, [collectionMaterials, selectedType, searchQuery]);

  async function toggleBookmark(id: string) {
    const previous = materials.find((m) => m.id === id)?.bookmarked ?? false;
    setMaterials((list) =>
      list.map((m) =>
        m.id === id
          ? {
              ...m,
              bookmarked: !previous,
              bookmarkCount: Math.max(0, m.bookmarkCount + (previous ? -1 : 1)),
            }
          : m,
      ),
    );
    try {
      const res = await fetch(`/api/materials/${id}/bookmark`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const confirmed = Boolean(data.bookmarked);
      setMaterials((list) =>
        list.map((m) => (m.id === id ? { ...m, bookmarked: confirmed } : m)),
      );
    } catch {
      setMaterials((list) =>
        list.map((m) => (m.id === id ? { ...m, bookmarked: previous } : m)),
      );
    }
  }

  function openDetails(m: StudyMaterialDto) {
    rememberRecentMaterial(m.id);
    setDetails(m);
  }

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [subjects, selectedSubjectId],
  );

  // Active view header title and subtitle
  const viewMeta = useMemo(() => {
    if (selectionMode === "SUBJECT" && selectedSubject) {
      return {
        title: `${selectedSubject.code}: ${selectedSubject.name}`,
        subtitle: `Enrolled Course · Semester ${selectedSubject.semester}`,
      };
    }
    if (selectionMode === "MY_SUBJECTS") {
      return {
        title: "Current Term Notes",
        subtitle: `${profile?.program?.name ?? "Academic Program"} · Semester ${mySemester ?? "—"}`,
      };
    }
    if (selectionMode === "BOOKMARKED") {
      return {
        title: "Bookmarked Materials",
        subtitle: "Saved notes and references kept for quick access",
      };
    }
    return {
      title: "All Institution Notes",
      subtitle: "Browse study materials and handouts across all programs",
    };
  }, [selectionMode, selectedSubject, profile, mySemester]);

  if (error) {
    return (
      <StudentShell title="Notes" active="/student/notes">
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive font-medium">
          {error}
        </p>
      </StudentShell>
    );
  }

  if (loading || !profile) {
    return (
      <StudentShell title="Notes" active="/student/notes">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4">
            <Skeleton className="h-120 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId =
    profile.rollNumber != null ? String(profile.rollNumber) : profile.enrollmentNumber;

  return (
    <StudentShell
      active="/student/notes"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Notes"
      subtitle="Study materials and lecture notes"
    >
      <div className="space-y-6">
        {/* ── 12-Column Master-Detail Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ════ LEFT COLUMN (4 cols): Subject Directory & Collections ════ */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="rounded-2xl border border-border/70 shadow-xs overflow-hidden bg-card">
              {/* Header */}
              <CardHeader className="p-4 sm:px-5 pb-3 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IconFolder size={16} />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-semibold">Course Materials</CardTitle>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {profile.program?.name} · Sem {mySemester ?? "—"}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-2 sm:p-2.5 space-y-3">
                {/* ── Section 1: Quick Collections ── */}
                <div className="space-y-1">
                  {/* My Subjects */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode("MY_SUBJECTS");
                      setSelectedSubjectId(null);
                      setSelectedType("ALL");
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectionMode === "MY_SUBJECTS"
                        ? "bg-primary/10 border-primary/50 text-foreground shadow-2xs ring-1 ring-primary/20"
                        : "bg-card hover:bg-muted/50 border-border/60 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs ${
                          selectionMode === "MY_SUBJECTS"
                            ? "bg-primary text-primary-foreground font-bold"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <IconBook2 size={14} />
                      </span>
                      <span
                        className={`text-xs font-semibold truncate ${
                          selectionMode === "MY_SUBJECTS" ? "text-primary font-bold" : ""
                        }`}
                      >
                        My Subjects
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-bold border-transparent px-2 py-0.5 ${
                        selectionMode === "MY_SUBJECTS"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {mySubjectsCount}
                    </Badge>
                  </button>

                  {/* All Materials */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode("ALL");
                      setSelectedSubjectId(null);
                      setSelectedType("ALL");
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectionMode === "ALL"
                        ? "bg-primary/10 border-primary/50 text-foreground shadow-2xs ring-1 ring-primary/20"
                        : "bg-card hover:bg-muted/50 border-border/60 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs ${
                          selectionMode === "ALL"
                            ? "bg-primary text-primary-foreground font-bold"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <IconFolder size={14} />
                      </span>
                      <span
                        className={`text-xs font-semibold truncate ${
                          selectionMode === "ALL" ? "text-primary font-bold" : ""
                        }`}
                      >
                        All Materials
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-bold border-transparent px-2 py-0.5 ${
                        selectionMode === "ALL"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {materials.length}
                    </Badge>
                  </button>

                  {/* Bookmarked */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode("BOOKMARKED");
                      setSelectedSubjectId(null);
                      setSelectedType("ALL");
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectionMode === "BOOKMARKED"
                        ? "bg-primary/10 border-primary/50 text-foreground shadow-2xs ring-1 ring-primary/20"
                        : "bg-card hover:bg-muted/50 border-border/60 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs ${
                          selectionMode === "BOOKMARKED"
                            ? "bg-amber-500 text-white font-bold"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        <IconStarFilled size={13} />
                      </span>
                      <span
                        className={`text-xs font-semibold truncate ${
                          selectionMode === "BOOKMARKED" ? "text-primary font-bold" : ""
                        }`}
                      >
                        Bookmarked
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-bold border-transparent px-2 py-0.5 ${
                        selectionMode === "BOOKMARKED"
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {bookmarkedCount}
                    </Badge>
                  </button>
                </div>

                {/* ── Section 2: Enrolled Courses List ── */}
                {enrolledSubjects.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between px-2 pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Enrolled Courses
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold border-transparent bg-primary/10 text-primary px-1.5 py-0"
                      >
                        Sem {mySemester}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      {enrolledSubjects.map((sub) => {
                        const count = subjectMaterialCounts.get(sub.id) ?? 0;
                        const isSelected =
                          selectionMode === "SUBJECT" && selectedSubjectId === sub.id;

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setSelectionMode("SUBJECT");
                              setSelectedSubjectId(sub.id);
                              setSelectedType("ALL");
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "bg-primary/10 border-primary/50 text-foreground shadow-2xs ring-1 ring-primary/20"
                                : "bg-card hover:bg-muted/50 border-border/60 text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-1">
                              <span
                                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border-transparent shrink-0 ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {sub.code}
                              </span>
                              <span
                                className={`text-xs font-semibold truncate ${
                                  isSelected ? "text-primary font-bold" : "text-foreground"
                                }`}
                                title={sub.name}
                              >
                                {sub.name}
                              </span>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              {count > 0 && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-bold border-transparent px-1.5 py-0 ${
                                    isSelected
                                      ? "bg-primary/20 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {count}
                                </Badge>
                              )}
                              <IconChevronRight
                                size={14}
                                className={
                                  isSelected ? "text-primary" : "text-muted-foreground/40"
                                }
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ════ RIGHT COLUMN (8 cols): Active Notes & Unified Filter ════ */}
          <div className="lg:col-span-8 space-y-4">
            {/* Header + Search Bar Card */}
            <Card className="rounded-xl border border-border/70 p-4 shadow-xs bg-card space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    {viewMeta.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{viewMeta.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-transparent bg-muted/60 text-foreground font-semibold text-xs px-2.5 py-1"
                  >
                    {filteredMaterials.length}{" "}
                    {filteredMaterials.length === 1 ? "Material" : "Materials"}
                  </Badge>
                </div>
              </div>

              {/* Single Streamlined Search & Filter Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                {/* Search Input */}
                <div className="relative flex-1 min-w-52">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search within titles, topics, instructor..."
                    className="pl-9 pr-8 text-xs sm:text-sm h-9.5 rounded-lg"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Material Type Filter Pills */}
              {availableTypes.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50">
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                    Type:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedType("ALL")}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      selectedType === "ALL"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Types
                  </button>
                  {availableTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSelectedType(t.value)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        selectedType === t.value
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                  {(selectedType !== "ALL" || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedType("ALL");
                        setSearchQuery("");
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1 cursor-pointer"
                    >
                      Reset filter
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* Notes Grid or Empty State */}
            {filteredMaterials.length === 0 ? (
              <Card className="rounded-xl border-dashed p-12 text-center bg-card/60">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mx-auto">
                  <IconFileText size={24} />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {searchQuery
                    ? "No materials match your search"
                    : selectionMode === "BOOKMARKED"
                    ? "No bookmarked materials yet"
                    : selectionMode === "SUBJECT"
                    ? `No notes published for ${selectedSubject?.name ?? "this subject"}`
                    : "No materials found in this collection"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  {searchQuery
                    ? `Try searching with different keywords or clearing the active type filter.`
                    : selectionMode === "BOOKMARKED"
                    ? "Click the star icon on any material card to save it here for fast revision."
                    : "Teachers have not uploaded materials for this course yet. Check All Materials to explore the general library."}
                </p>
                {(searchQuery || selectedType !== "ALL") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs font-medium"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedType("ALL");
                    }}
                  >
                    Clear Search &amp; Filters
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredMaterials.map((m) => (
                  <MaterialCard
                    key={m.id}
                    material={m}
                    onToggleBookmark={toggleBookmark}
                    onOpenDetails={openDetails}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Material Preview Dialog */}
      {details && (
        <MaterialPreviewModal material={details} onClose={() => setDetails(null)} />
      )}
    </StudentShell>
  );
}
