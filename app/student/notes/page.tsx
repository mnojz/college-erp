"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { MaterialCard } from "@/app/components/materials/MaterialCard";
import { AdminModal } from "@/app/components/admin/AdminModal";
import {
  formatBytes,
  formatDate,
  MATERIAL_TYPES,
  materialTypeLabel,
  readRecentMaterialIds,
  rememberRecentMaterial,
  VISIBILITY_LABELS,
  type ProgramsMeta,
  type StudyMaterialDto,
} from "@/app/lib/materials-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  program: { id: string; name: string; code: string; departmentName: string } | null;
};

type Subject = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
};

type TabKey = "MY_SUBJECTS" | "ALL" | "RECENT" | "BOOKMARKED";

const TABS: { key: TabKey; label: string }[] = [
  { key: "MY_SUBJECTS", label: "My Subjects" },
  { key: "ALL", label: "All Materials" },
  { key: "RECENT", label: "Recent" },
  { key: "BOOKMARKED", label: "Bookmarked" },
];

const EMPTY_FILTERS = {
  q: "",
  programId: "",
  semester: "",
  subjectId: "",
  topic: "",
  type: "",
  uploaderId: "",
};

export default function StudentNotesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [materials, setMaterials] = useState<StudyMaterialDto[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({ departments: [], programs: [], subjects: [], teachers: [] });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("MY_SUBJECTS");
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [recentIds, setRecentIds] = useState<string[]>([]);
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
        setRecentIds(readRecentMaterialIds());

        const subjectParam = new URLSearchParams(window.location.search).get("subjectId");
        if (
          subjectParam &&
          (subjectsData.subjects ?? []).some((s: { id: string }) => s.id === subjectParam)
        ) {
          setFilters({ ...EMPTY_FILTERS, subjectId: subjectParam });
          setActiveTab("ALL");
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
      subjects.filter((s) => s.programId === myProgramId && s.semester === mySemester).map((s) => s.id),
    );
  }, [subjects, myProgramId, mySemester]);

  function matchesMySubjects(m: StudyMaterialDto): boolean {
    if (m.subjectId && mySubjectIds.has(m.subjectId)) return true;
    if (!m.subjectId && m.programId && m.programId === myProgramId && m.semester != null) {
      return m.semester === mySemester;
    }
    return false;
  }

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const topicQ = filters.topic.trim().toLowerCase();

    let list: StudyMaterialDto[];
    if (activeTab === "MY_SUBJECTS") {
      list = materials.filter(matchesMySubjects);
    } else if (activeTab === "BOOKMARKED") {
      list = materials.filter((m) => m.bookmarked);
    } else if (activeTab === "RECENT") {
      const byId = new Map(materials.map((m) => [m.id, m]));
      list = recentIds.map((id) => byId.get(id)).filter((m): m is StudyMaterialDto => Boolean(m));
      return list;
    } else {
      list = materials;
    }

    if (q) {
      list = list.filter((m) => {
        const haystack = [
          m.title,
          m.description ?? "",
          m.topic ?? "",
          m.subject?.name ?? "",
          m.subject?.code ?? "",
          m.program?.name ?? "",
          m.program?.code ?? "",
          m.departmentName ?? "",
          m.uploader.name,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    if (filters.programId) list = list.filter((m) => m.program?.id === filters.programId);
    if (filters.semester) list = list.filter((m) => String(m.semester ?? "") === filters.semester);
    if (filters.subjectId) list = list.filter((m) => m.subject?.id === filters.subjectId);
    if (filters.type) list = list.filter((m) => m.materialType === filters.type);
    if (filters.uploaderId) list = list.filter((m) => m.uploader.id === filters.uploaderId);
    if (topicQ) list = list.filter((m) => (m.topic ?? "").toLowerCase().includes(topicQ));

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, activeTab, filters, recentIds, mySubjectIds, myProgramId, mySemester]);

  async function toggleBookmark(id: string) {
    const previous = materials.find((m) => m.id === id)?.bookmarked ?? false;
    setMaterials((list) =>
      list.map((m) =>
        m.id === id
          ? { ...m, bookmarked: !previous, bookmarkCount: Math.max(0, m.bookmarkCount + (previous ? -1 : 1)) }
          : m,
      ),
    );
    try {
      const res = await fetch(`/api/materials/${id}/bookmark`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const confirmed = Boolean(data.bookmarked);
      setMaterials((list) =>
        list.map((m) =>
          m.id === id
            ? { ...m, bookmarked: confirmed }
            : m,
        ),
      );
    } catch {
      setMaterials((list) => list.map((m) => (m.id === id ? { ...m, bookmarked: previous } : m)));
    }
  }

  function openDetails(m: StudyMaterialDto) {
    rememberRecentMaterial(m.id);
    setRecentIds(readRecentMaterialIds());
    setDetails(m);
  }

  function downloadMaterial(id: string) {
    rememberRecentMaterial(id);
    setRecentIds(readRecentMaterialIds());
    const link = document.createElement("a");
    link.href = `/api/materials/${id}/file`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function updateFilter(key: keyof typeof EMPTY_FILTERS, value: string) {
    setFilters((f) => ({
      ...EMPTY_FILTERS,
      ...f,
      [key]: value,
      ...(key === "programId" ? { subjectId: "" } : {}),
    }));
  }

  if (error) {
    return (
      <StudentShell title="Notes & Study Material" active="/student/notes">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      </StudentShell>
    );
  }
  if (loading || !profile) {
    return (
      <StudentShell title="Notes & Study Material" active="/student/notes">
        <Skeleton className="h-48 w-full" />
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  // Roll numbers are integers now; StudentShell takes a display string.
  const studentId = profile.rollNumber != null ? String(profile.rollNumber) : profile.enrollmentNumber;

  const myProgramFilteredPrograms = meta.programs;
  const subjectOptions = filters.programId
    ? meta.subjects.filter((s) => s.programId === filters.programId)
    : meta.subjects;

  const activeFiltersCount = Object.values(filters).filter((v) => v.trim() !== "").length;

  return (
    <StudentShell
      active="/student/notes"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Notes & Study Material"
      subtitle="College Study Library"
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Available Materials</p>
              <p className="mt-1 text-3xl font-bold">{materials.length}</p>
              <small className="text-xs text-muted-foreground">Visible across the college</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">For My Subjects</p>
              <p className="mt-1 text-3xl font-bold">{materials.filter(matchesMySubjects).length}</p>
              <small className="text-xs text-muted-foreground">
                {profile.program ? `${profile.program.code}${mySemester ? ` · Semester ${mySemester}` : ""}` : "Set your program"}
              </small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Bookmarked</p>
              <p className="mt-1 text-3xl font-bold">{materials.filter((m) => m.bookmarked).length}</p>
              <small className="text-xs text-muted-foreground">Saved for quick access</small>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="relative min-w-0">
              <Input
                type="search"
                value={filters.q}
                onChange={(e) => updateFilter("q", e.target.value)}
                placeholder="Search by title, subject, topic…"
                aria-label="Search study materials"
              />
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
              <TabsList className="flex w-full flex-wrap sm:w-auto">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                    {tab.key === "BOOKMARKED" && materials.some((m) => m.bookmarked) && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
                        {materials.filter((m) => m.bookmarked).length}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {activeTab === "MY_SUBJECTS" && (
              <p className="text-sm text-muted-foreground">
                Showing materials automatically matched to{" "}
                <strong className="text-foreground">
                  {profile.program?.name ?? "your program"}
                  {mySemester ? ` · Semester ${mySemester}` : ""}
                </strong>
                . Switch to <em>All Materials</em> to discover notes beyond your curriculum.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.programId || undefined} onValueChange={(value) => updateFilter("programId", value)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Program filter">
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent>
              {myProgramFilteredPrograms.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.semester || undefined} onValueChange={(value) => updateFilter("semester", value)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Semester filter">
              <SelectValue placeholder="All Semesters" />
            </SelectTrigger>
            <SelectContent>
              {[...new Set(materials.map((m) => m.semester).filter((s): s is number => s != null))]
                .sort((a, b) => a - b)
                .map((s) => (
                  <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={filters.subjectId || undefined} onValueChange={(value) => updateFilter("subjectId", value)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Subject filter">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.type || undefined} onValueChange={(value) => updateFilter("type", value)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Material type filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.uploaderId || undefined} onValueChange={(value) => updateFilter("uploaderId", value)}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Teacher filter">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              {meta.teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button type="button" variant="ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
              Reset ({activeFiltersCount})
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Showing <strong className="text-foreground">{filtered.length}</strong> of {materials.length} materials
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-md border bg-muted/40 px-4 py-12 text-center">
            <h3 className="mb-1 text-sm font-semibold">
              {activeTab === "MY_SUBJECTS" ? "No materials matched to your subjects yet" : "Nothing here yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {activeTab === "MY_SUBJECTS"
                ? "Teachers haven't published material for your current program/semester so far. Browse All Materials to explore the full library."
                : activeTab === "RECENT"
                  ? "Materials you open or download will appear here."
                  : activeTab === "BOOKMARKED"
                    ? "Bookmark materials with the star button to keep them one click away."
                    : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
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

      {details && (
        <AdminModal title="Study Material" onClose={() => setDetails(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{materialTypeLabel(details.materialType)}</Badge>
              {details.subject && <Badge variant="secondary">{details.subject.code}</Badge>}
              {details.topic && <Badge variant="outline">{details.topic}</Badge>}
            </div>
            <h3 className="text-lg font-semibold">{details.title}</h3>
            {details.description && <p className="text-sm text-muted-foreground">{details.description}</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Subject</dt>
              <dd>{details.subject ? details.subject.name : "General"}</dd>
              <dt className="text-muted-foreground">Teacher</dt>
              <dd>{details.uploader.name}</dd>
              <dt className="text-muted-foreground">Department / Program</dt>
              <dd>
                {details.departmentName ?? "—"}
                {details.program ? ` · ${details.program.name}` : ""}
              </dd>
              <dt className="text-muted-foreground">Semester</dt>
              <dd>{details.semester ?? "—"}</dd>
              <dt className="text-muted-foreground">Visibility</dt>
              <dd>{VISIBILITY_LABELS[details.visibility] ?? details.visibility}</dd>
              <dt className="text-muted-foreground">File</dt>
              <dd>{details.fileName} ({formatBytes(details.fileSize)})</dd>
              <dt className="text-muted-foreground">Uploaded</dt>
              <dd>{formatDate(details.createdAt)}</dd>
            </dl>
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="ghost" type="button" onClick={() => setDetails(null)}>
                Close
              </Button>
              <Button type="button" onClick={() => downloadMaterial(details.id)}>
                Download
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
    </StudentShell>
  );
}
