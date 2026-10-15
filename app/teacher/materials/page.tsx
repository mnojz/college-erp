"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { AdminModal } from "@/app/components/admin/AdminModal";
import {
  MaterialForm,
  type AssignedSubject,
  type MaterialSubmitValues,
} from "@/app/components/materials/MaterialForm";
import { MaterialPreviewModal } from "@/app/components/materials/MaterialPreviewModal";
import { getFileIconInfo } from "@/app/components/materials/material-file-icon";
import {
  formatBytes,
  formatDate,
  type ProgramsMeta,
  type StudyMaterialDto,
} from "@/app/lib/materials-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBook2,
  IconBooks,
  IconBuilding,
  IconCircleCheck,
  IconClock,
  IconDatabase,
  IconDownload,
  IconEye,
  IconFileText,
  IconFilter,
  IconFlask,
  IconGridDots,
  IconHelpCircle,
  IconLayoutList,
  IconLock,
  IconPencil,
  IconPresentation,
  IconRefresh,
  IconSearch,
  IconStarFilled,
  IconTrash,
  IconUpload,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type TeacherInfo = {
  user: { firstName: string; lastName: string };
  employeeNo: string;
  profileImageUrl: string | null;
  subjectTeachers?: {
    subject: {
      id: string;
      name: string;
      code: string;
      semester: number;
      programId?: string;
      program?: {
        id: string;
        name: string;
        code: string;
        departmentName?: string;
        durationYears?: number;
      };
    };
  }[];
  classes: {
    id: string;
    semester: number;
    subject: { id: string; name: string; code: string };
    program: { id: string; name: string; code: string; departmentName?: string; durationYears?: number };
  }[];
};

type ClassGroup = { key: string; label: string; classIds: string[]; subjectId: string };

type MaterialCategoryTab = "ALL" | "LECTURE_NOTES" | "SLIDES" | "QUESTIONS" | "LAB" | "ASSIGNMENTS" | "OTHER";
type SortOption = "newest" | "oldest" | "alpha" | "size-desc" | "bookmarks";
type ViewMode = "grid" | "list";

function getMaterialTypeBadge(type: string) {
  switch (type) {
    case "LECTURE_NOTES":
      return {
        label: "Lecture Notes",
        badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-transparent",
        iconClass: "text-sky-600 dark:text-sky-400 bg-sky-500/10",
        Icon: IconFileText,
      };
    case "SLIDES":
      return {
        label: "Slides",
        badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-transparent",
        iconClass: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
        Icon: IconPresentation,
      };
    case "QUESTION_BANK":
      return {
        label: "Question Bank",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
        iconClass: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
        Icon: IconHelpCircle,
      };
    case "LAB_MANUAL":
      return {
        label: "Lab Manual",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
        iconClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
        Icon: IconFlask,
      };
    case "ASSIGNMENT":
      return {
        label: "Assignment",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-transparent",
        iconClass: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
        Icon: IconBook2,
      };
    case "PAST_PAPER":
      return {
        label: "Past Paper",
        badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-transparent",
        iconClass: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
        Icon: IconBooks,
      };
    case "REFERENCE_MATERIAL":
      return {
        label: "Reference",
        badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-transparent",
        iconClass: "text-teal-600 dark:text-teal-400 bg-teal-500/10",
        Icon: IconBook2,
      };
    default:
      return {
        label: "Document",
        badgeClass: "bg-muted text-muted-foreground border-transparent",
        iconClass: "text-muted-foreground bg-muted",
        Icon: IconFileText,
      };
  }
}

function getVisibilityMeta(visibility: string) {
  switch (visibility) {
    case "EVERYONE":
      return {
        label: "Public Library",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent",
        Icon: IconWorld,
      };
    case "DEPARTMENT_PROGRAM":
      return {
        label: "Program Only",
        badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-transparent",
        Icon: IconBuilding,
      };
    case "CLASSES":
      return {
        label: "Class Restricted",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent",
        Icon: IconLock,
      };
    default:
      return {
        label: visibility,
        badgeClass: "bg-muted text-muted-foreground border-transparent",
        Icon: IconLock,
      };
  }
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toUpperCase() ?? "FILE" : "FILE";
}

export default function TeacherMaterialsPage() {
  const router = useRouter();
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [materials, setMaterials] = useState<StudyMaterialDto[]>([]);
  const [meta, setMeta] = useState<ProgramsMeta>({ departments: [], programs: [], subjects: [], teachers: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryTab, setCategoryTab] = useState<MaterialCategoryTab>("ALL");
  const [selectedClassKey, setSelectedClassKey] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<StudyMaterialDto | null>(null);
  const [deleting, setDeleting] = useState<StudyMaterialDto | null>(null);
  const [previewItem, setPreviewItem] = useState<StudyMaterialDto | null>(null);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch("/api/teacher/profile");
        if (profileRes.status === 401 || profileRes.status === 403) {
          router.replace("/dashboard");
          return;
        }
        const [materialsRes, metaRes] = await Promise.all([
          fetch("/api/materials?mine=1"),
          fetch("/api/materials/meta"),
        ]);
        if (!profileRes.ok || !materialsRes.ok || !metaRes.ok) {
          setLoadError("Unable to load your uploads");
          return;
        }
        const profileData = await profileRes.json();
        const materialsData = await materialsRes.json();
        const metaData = await metaRes.json();

        setTeacherInfo(profileData.teacher);
        setMaterials(materialsData.materials ?? []);
        setMeta({
          departments: metaData.departments ?? [],
          programs: metaData.programs ?? [],
          subjects: metaData.subjects ?? [],
          teachers: metaData.teachers ?? [],
        });

        // Check if subjectId query param is present on mount
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const subId = params.get("subjectId");
          if (subId) {
            setSelectedClassKey(subId);
          }
        }
      } catch {
        setLoadError("Unable to reach the server");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  /** Teaching groups (deduped by subject+program+semester across schedule slots). */
  const classGroups: ClassGroup[] = useMemo(() => {
    if (!teacherInfo?.classes?.length) return [];
    const groups = new Map<string, ClassGroup>();
    for (const c of teacherInfo.classes) {
      const key = `${c.subject.id}__${c.program.id}__${c.semester}`;
      const existing = groups.get(key);
      if (existing) {
        existing.classIds.push(c.id);
      } else {
        groups.set(key, {
          key,
          label: `${c.subject.name} (${c.subject.code}) — ${c.program.code} · Sem ${c.semester}`,
          classIds: [c.id],
          subjectId: c.subject.id,
        });
      }
    }
    return [...groups.values()];
  }, [teacherInfo]);

  /** Subjects assigned to this teacher (from curriculum subject assignments & schedule classes). */
  const assignedSubjects = useMemo<AssignedSubject[]>(() => {
    const map = new Map<string, AssignedSubject>();

    // 1. From subject assignments (subjectTeachers)
    if (teacherInfo?.subjectTeachers) {
      for (const st of teacherInfo.subjectTeachers) {
        if (st.subject && !map.has(st.subject.id)) {
          map.set(st.subject.id, {
            id: st.subject.id,
            name: st.subject.name,
            code: st.subject.code,
            semester: st.subject.semester,
            programId: st.subject.programId ?? st.subject.program?.id ?? "",
            programName: st.subject.program?.name,
            programCode: st.subject.program?.code,
            departmentName: st.subject.program?.departmentName ?? undefined,
          });
        }
      }
    }

    // 2. From scheduled classes
    if (teacherInfo?.classes) {
      for (const c of teacherInfo.classes) {
        if (c.subject && !map.has(c.subject.id)) {
          map.set(c.subject.id, {
            id: c.subject.id,
            name: c.subject.name,
            code: c.subject.code,
            semester: c.semester,
            programId: c.program.id,
            programName: c.program.name,
            programCode: c.program.code,
            departmentName: c.program.departmentName ?? undefined,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [teacherInfo]);

  // Aggregate stats
  const totalStorage = useMemo(() => materials.reduce((sum, m) => sum + m.fileSize, 0), [materials]);
  const distinctSubjectsCount = useMemo(() => {
    const s = new Set<string>();
    for (const m of materials) {
      if (m.subject) s.add(m.subject.id);
    }
    return s.size;
  }, [materials]);
  const totalBookmarks = useMemo(() => materials.reduce((sum, m) => sum + m.bookmarkCount, 0), [materials]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: materials.length,
      LECTURE_NOTES: 0,
      SLIDES: 0,
      QUESTIONS: 0,
      LAB: 0,
      ASSIGNMENTS: 0,
      OTHER: 0,
    };
    for (const m of materials) {
      if (m.materialType === "LECTURE_NOTES") counts.LECTURE_NOTES++;
      else if (m.materialType === "SLIDES") counts.SLIDES++;
      else if (m.materialType === "QUESTION_BANK" || m.materialType === "PAST_PAPER") counts.QUESTIONS++;
      else if (m.materialType === "LAB_MANUAL") counts.LAB++;
      else if (m.materialType === "ASSIGNMENT") counts.ASSIGNMENTS++;
      else counts.OTHER++;
    }
    return counts;
  }, [materials]);

  // Filtered & sorted materials
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return materials
      .filter((m) => {
        // Tab Category Filter
        if (categoryTab === "LECTURE_NOTES" && m.materialType !== "LECTURE_NOTES") return false;
        if (categoryTab === "SLIDES" && m.materialType !== "SLIDES") return false;
        if (categoryTab === "QUESTIONS" && m.materialType !== "QUESTION_BANK" && m.materialType !== "PAST_PAPER") {
          return false;
        }
        if (categoryTab === "LAB" && m.materialType !== "LAB_MANUAL") return false;
        if (categoryTab === "ASSIGNMENTS" && m.materialType !== "ASSIGNMENT") return false;
        if (
          categoryTab === "OTHER" &&
          ["LECTURE_NOTES", "SLIDES", "QUESTION_BANK", "PAST_PAPER", "LAB_MANUAL", "ASSIGNMENT"].includes(m.materialType)
        ) {
          return false;
        }

        // Class / Subject Filter
        if (selectedClassKey !== "ALL") {
          const matchClassGroup = classGroups.find((g) => g.key === selectedClassKey || g.subjectId === selectedClassKey);
          if (matchClassGroup) {
            if (m.subjectId !== matchClassGroup.subjectId) return false;
          } else if (m.subjectId !== selectedClassKey) {
            return false;
          }
        }

        // Search Query Filter
        if (q) {
          const matches =
            m.title.toLowerCase().includes(q) ||
            (m.description?.toLowerCase().includes(q) ?? false) ||
            m.fileName.toLowerCase().includes(q) ||
            (m.subject?.name.toLowerCase().includes(q) ?? false) ||
            (m.subject?.code.toLowerCase().includes(q) ?? false) ||
            (m.program?.code.toLowerCase().includes(q) ?? false) ||
            (m.topic?.toLowerCase().includes(q) ?? false);

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "alpha") {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "size-desc") {
          return b.fileSize - a.fileSize;
        }
        if (sortBy === "bookmarks") {
          return b.bookmarkCount - a.bookmarkCount;
        }
        // newest first (default)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [materials, categoryTab, selectedClassKey, searchQuery, sortBy, classGroups]);

  const hasActiveFilters = searchQuery !== "" || categoryTab !== "ALL" || selectedClassKey !== "ALL" || sortBy !== "newest";

  function handleResetFilters() {
    setSearchQuery("");
    setCategoryTab("ALL");
    setSelectedClassKey("ALL");
    setSortBy("newest");
  }

  function buildFormData(values: MaterialSubmitValues): FormData {
    const fd = new FormData();
    fd.set("title", values.title);
    if (values.description) fd.set("description", values.description);
    fd.set("materialType", values.materialType);
    fd.set("visibility", values.visibility);
    if (values.departmentName) fd.set("departmentName", values.departmentName);
    if (values.programId) fd.set("programId", values.programId);
    if (values.semester) fd.set("semester", values.semester);
    if (values.subjectId) fd.set("subjectId", values.subjectId);
    fd.set("classIds", JSON.stringify(values.classIds));
    return fd;
  }

  async function refreshMaterials() {
    const res = await fetch("/api/materials?mine=1");
    if (res.ok) {
      const data = await res.json();
      setMaterials(data.materials ?? []);
    }
  }

  async function handleCreate(values: MaterialSubmitValues) {
    setFormError("");
    setSaving(true);
    try {
      const fd = buildFormData(values);
      if (values.file) fd.set("file", values.file);
      const res = await fetch("/api/materials", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to upload material");
        return;
      }
      await refreshMaterials();
      setShowCreateModal(false);
      toast.success(`"${values.title}" uploaded to library successfully.`);
    } catch {
      setFormError("Failed to upload material");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(values: MaterialSubmitValues) {
    if (!editing) return;
    setFormError("");
    setSaving(true);
    try {
      const fd = buildFormData(values);
      if (values.file) fd.set("file", values.file);
      const res = await fetch(`/api/materials/${editing.id}`, { method: "PATCH", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to update material");
        return;
      }
      await refreshMaterials();
      setEditing(null);
      toast.success(`"${values.title}" has been updated.`);
    } catch {
      setFormError("Failed to update material");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/materials/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to delete material");
        toast.error(data.error ?? "Failed to delete material");
        return;
      }
      setMaterials((list) => list.filter((m) => m.id !== deleting.id));
      setDeleting(null);
      toast.success(`Deleted "${deleting.title}".`);
    } catch {
      setFormError("Failed to delete material");
      toast.error("Failed to delete material");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <main className="grid min-h-[40vh] place-items-center px-6 text-sm font-semibold text-destructive">
        {loadError}
      </main>
    );
  }

  if (loading || !teacherInfo) {
    return (
      <TeacherShell
        active="/teacher/materials"
        title="Study Materials & Notes"
        subtitle="Upload and manage academic resources for your classes"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      active="/teacher/materials"
      title="Study Materials & Notes"
      subtitle="Publish and organize academic resources, lecture slides, question banks, and notes"
      teacherName={`${teacherInfo.user.firstName} ${teacherInfo.user.lastName}`}
      employeeNo={teacherInfo.employeeNo}
      avatarUrl={teacherInfo.profileImageUrl}
      headerActions={
        <Button
          type="button"
          onClick={() => {
            setFormError("");
            setShowCreateModal(true);
          }}
          className="gap-1.5 shadow-xs"
        >
          <IconUpload size={16} aria-hidden="true" />
          <span>Upload Material</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* KPI Metrics Strip */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-colors hover:border-border">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconBooks size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{materials.length}</p>
              <p className="text-xs font-medium text-muted-foreground">Total Materials</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-colors hover:border-border">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <IconDatabase size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{formatBytes(totalStorage)}</p>
              <p className="text-xs font-medium text-muted-foreground">Storage Footprint</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-colors hover:border-border">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IconBook2 size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{distinctSubjectsCount}</p>
              <p className="text-xs font-medium text-muted-foreground">Subjects Covered</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-colors hover:border-border">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <IconStarFilled size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{totalBookmarks}</p>
              <p className="text-xs font-medium text-muted-foreground">Student Bookmarks</p>
            </div>
          </div>
        </section>

        {/* Global form error message (when modal not open) */}
        {formError && !showCreateModal && !editing && !deleting && (
          <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-2xs">
            <div className="flex items-center gap-2">
              <IconAlertTriangle size={18} aria-hidden="true" className="shrink-0" />
              <span>{formError}</span>
            </div>
            <button
              type="button"
              onClick={() => setFormError("")}
              className="text-xs opacity-75 hover:opacity-100"
              aria-label="Dismiss error"
            >
              <IconX size={15} />
            </button>
          </div>
        )}

        {/* Interactive Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative min-w-60 flex-1">
              <IconSearch
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="Search materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm rounded-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search input"
                >
                  <IconX size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Right Controls: Class Filter, Sort, View Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Teaching Group Selector */}
              {classGroups.length > 0 && (
                <select
                  value={selectedClassKey}
                  onChange={(e) => setSelectedClassKey(e.target.value)}
                  className="h-9 max-w-50 truncate rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-2xs hover:bg-accent/5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  aria-label="Filter by class or subject"
                >
                  <option value="ALL">All Teaching Classes</option>
                  {classGroups.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-2xs hover:bg-accent/5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                aria-label="Sort materials"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="alpha">Sort: Alphabetical (A-Z)</option>
                <option value="size-desc">Sort: Largest File</option>
                <option value="bookmarks">Sort: Most Bookmarked</option>
              </select>

              {/* View Mode Switcher */}
              <div className="hidden sm:flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
                    viewMode === "grid"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <IconGridDots size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md text-xs transition-colors",
                    viewMode === "list"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="List view"
                  aria-label="List view"
                >
                  <IconLayoutList size={15} aria-hidden="true" />
                </button>
              </div>

              <Button
                variant="outline"
                size="icon-sm"
                type="button"
                onClick={refreshMaterials}
                title="Refresh materials"
                aria-label="Refresh materials"
              >
                <IconRefresh size={15} aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Category Tabs Strip */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5 text-xs">
            <span className="mr-1 flex items-center gap-1 text-muted-foreground font-medium">
              <IconFilter size={13} aria-hidden="true" />
              <span>Category:</span>
            </span>

            <button
              type="button"
              onClick={() => setCategoryTab("ALL")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryTab === "ALL"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All ({categoryCounts.ALL})
            </button>

            <button
              type="button"
              onClick={() => setCategoryTab("LECTURE_NOTES")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryTab === "LECTURE_NOTES"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Notes ({categoryCounts.LECTURE_NOTES})
            </button>

            <button
              type="button"
              onClick={() => setCategoryTab("SLIDES")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryTab === "SLIDES"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Slides ({categoryCounts.SLIDES})
            </button>

            <button
              type="button"
              onClick={() => setCategoryTab("QUESTIONS")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryTab === "QUESTIONS"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Questions &amp; Papers ({categoryCounts.QUESTIONS})
            </button>

            <button
              type="button"
              onClick={() => setCategoryTab("LAB")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryTab === "LAB"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Lab Manuals ({categoryCounts.LAB})
            </button>

            <button
              type="button"
              onClick={() => setCategoryTab("ASSIGNMENTS")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                categoryTab === "ASSIGNMENTS"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Assignments ({categoryCounts.ASSIGNMENTS})
            </button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="ml-auto h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>

        {/* Empty state: No materials found */}
        {filteredMaterials.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <IconBooks size={26} aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {hasActiveFilters ? "No matching study materials" : "No study materials uploaded yet"}
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your search keywords, clear category filters, or select all classes."
                : "Upload lecture notes, presentation slides, lab manuals, or question banks to share with your enrolled students."}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4 shadow-2xs">
                Clear all filters
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setFormError("");
                  setShowCreateModal(true);
                }}
                className="mt-4 gap-1.5 shadow-2xs"
              >
                <IconUpload size={14} aria-hidden="true" />
                Upload Your First Material
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View Mode */
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map((m) => {
              const typeMeta = getMaterialTypeBadge(m.materialType);
              const fileInfo = getFileIconInfo(m.fileName);

              return (
                <Card
                  key={m.id}
                  onClick={() => setPreviewItem(m)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md cursor-pointer"
                >
                  <div className="flex flex-col gap-2">
                    {/* Top Row: Type & Subject on left, Actions on right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("gap-1 text-[11px] font-semibold tracking-wide py-0.5 px-2", typeMeta.badgeClass)}
                        >
                          <typeMeta.Icon size={12} className="shrink-0" aria-hidden="true" />
                          <span>{typeMeta.label}</span>
                        </Badge>

                        {m.subject && (
                          <span className="text-xs font-semibold text-foreground/80 truncate">
                            {m.subject.code}
                            {m.semester != null && (
                              <span className="font-normal text-muted-foreground"> · Sem {m.semester}</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Action buttons (click stopped from bubbling to card) */}
                      <div
                        className="flex shrink-0 items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          asChild
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Download File"
                          aria-label={`Download ${m.title}`}
                        >
                          <a href={`/api/materials/${m.id}/file`}>
                            <IconDownload size={14} aria-hidden="true" />
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit Material"
                          aria-label={`Edit ${m.title}`}
                          onClick={() => {
                            setFormError("");
                            setEditing(m);
                          }}
                        >
                          <IconPencil size={14} aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          title="Delete Material"
                          aria-label={`Delete ${m.title}`}
                          onClick={() => {
                            setFormError("");
                            setDeleting(m);
                          }}
                        >
                          <IconTrash size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <h3
                        title={m.title}
                        className="text-sm font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-1"
                      >
                        {m.title}
                      </h3>
                      {m.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {m.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: File Attachment Chip (tiled icon, bigger visibility, no date) */}
                  <div className="mt-2.5 flex items-stretch justify-between overflow-hidden rounded-xl border border-border/70 bg-muted/20 text-xs transition-colors group-hover:bg-muted/40 group-hover:border-border">
                    <div className="flex items-center min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex w-12 shrink-0 items-center justify-center self-stretch border-r transition-colors",
                          fileInfo.bg
                        )}
                      >
                        <fileInfo.Icon size={26} className={fileInfo.color} strokeWidth={1.8} aria-hidden="true" />
                      </div>
                      <div className="flex flex-col justify-center min-w-0 px-3 py-2">
                        <span className="truncate font-semibold text-foreground/90 text-xs" title={m.fileName}>
                          {m.fileName}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatBytes(m.fileSize)}
                        </span>
                      </div>
                    </div>

                    {m.bookmarkCount > 0 && (
                      <div className="flex items-center pr-3 shrink-0">
                        <span className="flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <IconStarFilled size={12} aria-hidden="true" />
                          <span>{m.bookmarkCount}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Table / List View Mode */
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Material Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Subject &amp; Class</th>
                    <th className="px-4 py-3">Visibility</th>
                    <th className="px-4 py-3">File Size</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3 text-center">Bookmarks</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredMaterials.map((m) => {
                    const typeMeta = getMaterialTypeBadge(m.materialType);
                    const visibilityMeta = getVisibilityMeta(m.visibility);
                    const extension = getFileExtension(m.fileName);

                    return (
                      <tr
                        key={m.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        {/* Title & File Name */}
                        <td className="px-4 py-3 font-medium">
                          <div
                            onClick={() => setPreviewItem(m)}
                            className="cursor-pointer font-semibold text-foreground hover:text-primary transition-colors max-w-xs truncate"
                          >
                            {m.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-semibold uppercase text-primary/80">{extension}</span>
                            <span>•</span>
                            <span className="truncate max-w-50">{m.fileName}</span>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-semibold gap-1", typeMeta.badgeClass)}
                          >
                            <typeMeta.Icon size={11} aria-hidden="true" />
                            <span>{typeMeta.label}</span>
                          </Badge>
                        </td>

                        {/* Subject & Class */}
                        <td className="px-4 py-3">
                          {m.subject ? (
                            <div>
                              <span className="font-semibold text-foreground">
                                {m.subject.code}
                              </span>
                              <span className="text-muted-foreground ml-1.5">
                                Sem {m.semester ?? "—"}
                              </span>
                              <div className="text-[11px] text-muted-foreground truncate max-w-37.5">
                                {m.subject.name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">General College</span>
                          )}
                        </td>

                        {/* Visibility */}
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-medium gap-1", visibilityMeta.badgeClass)}
                          >
                            <visibilityMeta.Icon size={11} aria-hidden="true" />
                            <span>{visibilityMeta.label}</span>
                          </Badge>
                        </td>

                        {/* File Size */}
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {formatBytes(m.fileSize)}
                        </td>

                        {/* Uploaded Date */}
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(m.createdAt)}
                        </td>

                        {/* Bookmarks */}
                        <td className="px-4 py-3 text-center">
                          {m.bookmarkCount > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                              <IconStarFilled size={12} aria-hidden="true" />
                              <span>{m.bookmarkCount}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              title="Download"
                              aria-label={`Download ${m.title}`}
                            >
                              <a href={`/api/materials/${m.id}/file`}>
                                <IconDownload size={14} aria-hidden="true" />
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              title="View details"
                              aria-label={`View details of ${m.title}`}
                              onClick={() => setPreviewItem(m)}
                            >
                              <IconEye size={14} aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              title="Edit"
                              aria-label={`Edit ${m.title}`}
                              onClick={() => {
                                setFormError("");
                                setEditing(m);
                              }}
                            >
                              <IconPencil size={14} aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-7 text-destructive hover:bg-destructive/10"
                              title="Delete"
                              aria-label={`Delete ${m.title}`}
                              onClick={() => {
                                setFormError("");
                                setDeleting(m);
                              }}
                            >
                              <IconTrash size={14} aria-hidden="true" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Upload new material */}
      {showCreateModal && (
        <AdminModal wide title="Upload Study Material" onClose={() => setShowCreateModal(false)}>
          <MaterialForm
            mode="create"
            meta={meta}
            assignedSubjects={assignedSubjects}
            classGroups={classGroups}
            submitting={saving}
            error={formError}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateModal(false)}
          />
        </AdminModal>
      )}

      {/* Modal 2: Edit existing upload */}
      {editing && (
        <AdminModal wide title="Edit Study Material" onClose={() => setEditing(null)}>
          <MaterialForm
            mode="edit"
            initial={{
              title: editing.title,
              description: editing.description,
              materialType: editing.materialType,
              visibility: editing.visibility,
              departmentName: editing.departmentName,
              programId: editing.program?.id ?? null,
              semester: editing.semester,
              subjectId: editing.subject?.id ?? null,
            }}
            meta={meta}
            assignedSubjects={assignedSubjects}
            classGroups={classGroups}
            submitting={saving}
            error={formError}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </AdminModal>
      )}

      {/* Modal 3: Delete confirmation */}
      {deleting && (
        <AdminModal title="Delete Study Material" onClose={() => setDeleting(null)}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-foreground">
              Are you sure you want to permanently delete <strong>&ldquo;{deleting.title}&rdquo;</strong>?
            </p>
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
              <IconAlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Students enrolled in this class will immediately lose access to this resource, including all student bookmarks.
              </span>
            </div>
            {formError && (
              <p className="text-xs text-destructive font-medium">{formError}</p>
            )}
            <div className="flex flex-wrap justify-end gap-2.5 pt-2">
              <Button
                variant="destructive"
                type="button"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting…" : "Yes, Delete Material"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setDeleting(null)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Modal 4: Custom Multi-Format File Previewer */}
      {previewItem && (
        <MaterialPreviewModal
          material={previewItem}
          onClose={() => setPreviewItem(null)}
          onEdit={(m) => setEditing(m)}
        />
      )}
    </TeacherShell>
  );
}
