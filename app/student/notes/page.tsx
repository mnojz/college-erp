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

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
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

        // Deep-link support: /student/notes?subjectId=... (from the Subjects hub).
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

  /** Subject ids of the student's current program + semester. */
  const mySubjectIds = useMemo(() => {
    if (!myProgramId || !mySemester) return new Set<string>();
    return new Set(
      subjects.filter((s) => s.programId === myProgramId && s.semester === mySemester).map((s) => s.id),
    );
  }, [subjects, myProgramId, mySemester]);

  function matchesMySubjects(m: StudyMaterialDto): boolean {
    if (m.subjectId && mySubjectIds.has(m.subjectId)) return true;
    // Curriculum-agnostic material still relevant to the student's semester.
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
    // Optimistic flip
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
      // Revert optimistic update on failure
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
      // reset dependent cascades
      ...(key === "programId" ? { subjectId: "" } : {}),
    }));
  }

  if (error) return <main className="profile-error">{error}</main>;
  if (loading || !profile) return <main className="profile-loading">Loading study materials…</main>;

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

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
      <section className="admin-metric-grid" style={{ marginBottom: "24px" }}>
        <article className="admin-metric-card">
          <span>Available Materials</span>
          <strong>{materials.length}</strong>
          <small>Visible across the college</small>
        </article>
        <article className="admin-metric-card">
          <span>For My Subjects</span>
          <strong>{materials.filter(matchesMySubjects).length}</strong>
          <small>
            {profile.program ? `${profile.program.code}${mySemester ? ` · Semester ${mySemester}` : ""}` : "Set your program"}
          </small>
        </article>
        <article className="admin-metric-card">
          <span>Bookmarked</span>
          <strong>{materials.filter((m) => m.bookmarked).length}</strong>
          <small>Saved for quick access</small>
        </article>
      </section>

      <div className="notes-toolbar">
        <div className="notes-search">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => updateFilter("q", e.target.value)}
            placeholder="Search by title, subject, topic…"
            aria-label="Search study materials"
          />
        </div>

        <div className="notes-tabs" role="tablist" aria-label="Material tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`notes-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === "BOOKMARKED" && materials.some((m) => m.bookmarked) && (
                <span className="notes-tab-count">{materials.filter((m) => m.bookmarked).length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "MY_SUBJECTS" && (
          <p className="notes-tab-hint">
            Showing materials automatically matched to{" "}
            <strong>
              {profile.program?.name ?? "your program"}
              {mySemester ? ` · Semester ${mySemester}` : ""}
            </strong>
            . Switch to <em>All Materials</em> to discover notes beyond your curriculum.
          </p>
        )}
      </div>

      <div className="notes-filter-row">
        <select value={filters.programId} onChange={(e) => updateFilter("programId", e.target.value)} aria-label="Program filter">
          <option value="">All Programs</option>
          {myProgramFilteredPrograms.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>

        <select value={filters.semester} onChange={(e) => updateFilter("semester", e.target.value)} aria-label="Semester filter">
          <option value="">All Semesters</option>
          {[...new Set(materials.map((m) => m.semester).filter((s): s is number => s != null))]
            .sort((a, b) => a - b)
            .map((s) => (
              <option key={s} value={String(s)}>Semester {s}</option>
            ))}
        </select>

        <select value={filters.subjectId} onChange={(e) => updateFilter("subjectId", e.target.value)} aria-label="Subject filter">
          <option value="">All Subjects</option>
          {subjectOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
          ))}
        </select>

        <select value={filters.type} onChange={(e) => updateFilter("type", e.target.value)} aria-label="Material type filter">
          <option value="">All Types</option>
          {MATERIAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select value={filters.uploaderId} onChange={(e) => updateFilter("uploaderId", e.target.value)} aria-label="Teacher filter">
          <option value="">All Teachers</option>
          {meta.teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <input
          type="text"
          value={filters.topic}
          onChange={(e) => updateFilter("topic", e.target.value)}
          placeholder="Topic"
          className="notes-topic-input"
          aria-label="Topic filter"
        />

        {activeFiltersCount > 0 && (
          <button type="button" className="btn-ghost" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
            Reset ({activeFiltersCount})
          </button>
        )}
      </div>

      <p className="notes-results-count">
        Showing <strong>{filtered.length}</strong> of {materials.length} materials
      </p>

      {filtered.length === 0 ? (
        <div className="profile-info-card notes-empty">
          <h3>{activeTab === "MY_SUBJECTS" ? "No materials matched to your subjects yet" : "Nothing here yet"}</h3>
          <p>
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
        <div className="notes-grid">
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

      {details && (
        <AdminModal title="Study Material" onClose={() => setDetails(null)}>
          <div className="note-details">
            <div className="note-card-chips" style={{ marginBottom: "10px" }}>
              <span className="type-pill">{materialTypeLabel(details.materialType)}</span>
              {details.subject && <span className="chip chip-sky">{details.subject.code}</span>}
              {details.topic && <span className="chip">{details.topic}</span>}
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem" }}>{details.title}</h3>
            {details.description && <p className="note-details-desc">{details.description}</p>}
            <dl className="note-details-grid">
              <dt>Subject</dt>
              <dd>{details.subject ? details.subject.name : "General"}</dd>
              <dt>Teacher</dt>
              <dd>{details.uploader.name}</dd>
              <dt>Department / Program</dt>
              <dd>
                {details.departmentName ?? "—"}
                {details.program ? ` · ${details.program.name}` : ""}
              </dd>
              <dt>Semester</dt>
              <dd>{details.semester ?? "—"}</dd>
              <dt>Visibility</dt>
              <dd>{VISIBILITY_LABELS[details.visibility] ?? details.visibility}</dd>
              <dt>File</dt>
              <dd>{details.fileName} ({formatBytes(details.fileSize)})</dd>
              <dt>Uploaded</dt>
              <dd>{formatDate(details.createdAt)}</dd>
            </dl>
            <div className="modal-actions">
              <button className="btn-primary" type="button" onClick={() => downloadMaterial(details.id)}>
                Download
              </button>
              <button className="btn-ghost" type="button" onClick={() => setDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </StudentShell>
  );
}





