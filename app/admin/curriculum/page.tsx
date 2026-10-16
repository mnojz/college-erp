"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabSwitcher } from "@/app/components/common/TabSwitcher";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { StudentCourseStructurePanel } from "@/app/components/academics/StudentCourseStructurePanel";
import { startProgress, doneProgress } from "@/app/components/layout/RouteProgress";
import { cn } from "@/lib/utils";
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconBook2,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconLayersLinked,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";

type Program = {
  id: string;
  name: string;
  code: string;
  durationYears: number;
  departmentName: string;
};

type DraftCourse = {
  code: string;
  name: string;
  credits: number;
  hasTheory: boolean;
  hasPractical: boolean;
};

type DraftSemester = {
  label: string;
  courses: DraftCourse[];
};

type DraftYear = {
  label: string;
  semesters: DraftSemester[];
};

type DraftElective = {
  group: "ELECTIVE_I" | "ELECTIVE_II";
  code: string;
  name: string;
  credits: number;
};

type Draft = {
  years: DraftYear[];
  electives: DraftElective[];
};

const emptyDraft: Draft = { years: [], electives: [] };

export default function AdminCurriculumPage() {
  const router = useRouter();

  // Programs & curriculum state
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [originalDraft, setOriginalDraft] = useState<Draft>(emptyDraft);
  const [hasCurriculum, setHasCurriculum] = useState(false);

  // Loading & network state
  const [loading, setLoading] = useState(true);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveTimestamp, setSaveTimestamp] = useState(Date.now());

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");
  const [yearFilter, setYearFilter] = useState<"ALL" | number>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Initial Load ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const me = await fetch("/api/auth/me");
      if (!me.ok || (await me.json()).user.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }
      const res = await fetch("/api/programs");
      const data = await res.json();
      const loaded: Program[] = data.programs ?? [];
      setPrograms(loaded);
      if (loaded.length > 0) setProgramId(loaded[0].id);
      setLoading(false);
    }
    load().catch(() => {
      setError("Unable to load programs");
      setLoading(false);
    });
  }, [router]);

  // ─── Fetch Curriculum for Selected Program ────────────────────────
  const loadCurriculum = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingCurriculum(true);
    startProgress();
    setError("");
    try {
      const res = await fetch(`/api/curriculum?programId=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load curriculum");

      if (!data.curriculum) {
        setDraft(emptyDraft);
        setOriginalDraft(emptyDraft);
        setHasCurriculum(false);
        return;
      }

      setHasCurriculum(true);
      const parsedDraft: Draft = {
        years: (data.curriculum.years ?? []).map(
          (y: {
            label: string;
            semesters: Array<{
              label: string;
              courses: Array<{
                code: string | null;
                name: string;
                credits: number;
                hasTheory?: boolean;
                hasPractical?: boolean;
              }>;
            }>;
          }) => ({
            label: y.label,
            semesters: (y.semesters ?? []).map((s) => ({
              label: s.label,
              courses: (s.courses ?? []).map((c) => ({
                code: c.code ?? "",
                name: c.name,
                credits: c.credits,
                hasTheory: c.hasTheory !== false,
                hasPractical: c.hasPractical === true,
              })),
            })),
          }),
        ),
        electives: (data.curriculum.electives ?? []).map(
          (e: {
            group: string;
            code: string | null;
            name: string;
            credits: number;
          }) => ({
            group: e.group as DraftElective["group"],
            code: e.code ?? "",
            name: e.name,
            credits: e.credits,
          }),
        ),
      };

      setDraft(parsedDraft);
      setOriginalDraft(parsedDraft);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load curriculum",
      );
    } finally {
      setLoadingCurriculum(false);
      doneProgress();
    }
  }, []);

  useEffect(() => {
    if (programId) void loadCurriculum(programId);
  }, [programId, loadCurriculum]);

  // ─── Selected Program Details ────────────────────────────────────
  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === programId),
    [programs, programId],
  );

  // ─── Metrics Calculation ─────────────────────────────────────────
  const metrics = useMemo(() => {
    let totalCredits = 0;
    let totalCourses = 0;
    let totalSemesters = 0;

    for (const y of draft.years) {
      totalSemesters += y.semesters.length;
      for (const s of y.semesters) {
        totalCourses += s.courses.length;
        for (const c of s.courses) {
          totalCredits += Number.isFinite(c.credits) ? c.credits : 0;
        }
      }
    }

    return {
      totalCredits,
      totalCourses,
      totalSemesters,
      totalYears: draft.years.length,
      totalElectives: draft.electives.length,
    };
  }, [draft]);

  // ─── Dirty Check ─────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(originalDraft);
  }, [draft, originalDraft]);

  // ─── Mutators ────────────────────────────────────────────────────
  function addYear() {
    setDraft((d) => {
      const nextYearNo = d.years.length + 1;
      const semNo = d.years.reduce((acc, y) => acc + y.semesters.length, 0) + 1;
      return {
        ...d,
        years: [
          ...d.years,
          {
            label: `Year ${nextYearNo}`,
            semesters: [{ label: `Semester ${semNo}`, courses: [] }],
          },
        ],
      };
    });
  }

  function removeYear(index: number) {
    setDraft((d) => ({ ...d, years: d.years.filter((_, i) => i !== index) }));
  }

  function updateYearLabel(index: number, label: string) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, i) => (i === index ? { ...y, label } : y)),
    }));
  }

  function addSemester(yearIndex: number) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: [
                ...y.semesters,
                {
                  label: `Semester ${
                    d.years
                      .slice(0, yearIndex)
                      .reduce((n, yy) => n + yy.semesters.length, 0) +
                    y.semesters.length +
                    1
                  }`,
                  courses: [],
                },
              ],
            }
          : y,
      ),
    }));
  }

  function removeSemester(yearIndex: number, semIndex: number) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? { ...y, semesters: y.semesters.filter((_, si) => si !== semIndex) }
          : y,
      ),
    }));
  }

  function updateSemesterLabel(
    yearIndex: number,
    semIndex: number,
    label: string,
  ) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex ? { ...s, label } : s,
              ),
            }
          : y,
      ),
    }));
  }

  function addCourse(yearIndex: number, semIndex: number) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex
                  ? {
                      ...s,
                      courses: [
                        ...s.courses,
                        {
                          code: "",
                          name: "",
                          credits: 3,
                          hasTheory: true,
                          hasPractical: false,
                        },
                      ],
                    }
                  : s,
              ),
            }
          : y,
      ),
    }));
  }

  function removeCourse(
    yearIndex: number,
    semIndex: number,
    courseIndex: number,
  ) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex
                  ? {
                      ...s,
                      courses: s.courses.filter((_, ci) => ci !== courseIndex),
                    }
                  : s,
              ),
            }
          : y,
      ),
    }));
  }

  function updateCourse(
    yearIndex: number,
    semIndex: number,
    courseIndex: number,
    patch: Partial<DraftCourse>,
  ) {
    setDraft((d) => ({
      ...d,
      years: d.years.map((y, yi) =>
        yi === yearIndex
          ? {
              ...y,
              semesters: y.semesters.map((s, si) =>
                si === semIndex
                  ? {
                      ...s,
                      courses: s.courses.map((c, ci) =>
                        ci === courseIndex ? { ...c, ...patch } : c,
                      ),
                    }
                  : s,
              ),
            }
          : y,
      ),
    }));
  }

  function addElective(group: DraftElective["group"]) {
    setDraft((d) => ({
      ...d,
      electives: [...d.electives, { group, code: "", name: "", credits: 3 }],
    }));
  }

  function removeElective(index: number) {
    setDraft((d) => ({
      ...d,
      electives: d.electives.filter((_, i) => i !== index),
    }));
  }

  function updateElective(index: number, patch: Partial<DraftElective>) {
    setDraft((d) => ({
      ...d,
      electives: d.electives.map((e, i) =>
        i === index ? { ...e, ...patch } : e,
      ),
    }));
  }


  function handleDiscard() {
    setDraft(JSON.parse(JSON.stringify(originalDraft)));
    toast.info("Unsaved changes discarded");
  }

  // ─── JSON Sample Generator, Exporter & Importer ────────────────────
  function downloadSampleCurriculumJson() {
    const sample = {
      program: selectedProgram?.code || "BE. ARCH",
      courses: [
        {
          code: "AR111",
          name: "Basic Design I",
          credits: 4,
          year: 1,
          semester: 1,
          type: "core",
          hasTheory: true,
          hasPractical: true,
        },
        {
          code: "SH112",
          name: "Engineering Mathematics I",
          credits: 3,
          year: 1,
          semester: 1,
          type: "core",
          hasTheory: true,
          hasPractical: false,
        },
        {
          code: "AR121",
          name: "Architectural Graphics I",
          credits: 3,
          year: 1,
          semester: 2,
          type: "core",
          hasTheory: false,
          hasPractical: true,
        },
      ],
      elective_groups: [
        {
          group_id: 1,
          name: "Elective I",
          target_semester: 7,
          required_credits: 3,
          options: [
            {
              code: "AR4701",
              name: "Light Weight Construction Materials and Building Technology",
              credits: 3,
            },
            {
              code: "AR4702",
              name: "Disaster Risk Management in Traditional Settlement",
              credits: 3,
            },
          ],
        },
      ],
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProgram?.code || "curriculum"}_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Sample curriculum JSON downloaded.");
  }

  function exportCurriculumJson() {
    if (draft.years.length === 0) {
      toast.error("No curriculum data to export.");
      return;
    }

    let globalSem = 0;
    const courses = draft.years.flatMap((y, yIdx) =>
      y.semesters.flatMap((s) => {
        globalSem += 1;
        return s.courses.map((c) => ({
          code: c.code || null,
          name: c.name,
          credits: c.credits,
          year: yIdx + 1,
          semester: globalSem,
          type: c.hasPractical && !c.hasTheory ? "practical" : "core",
          hasTheory: c.hasTheory,
          hasPractical: c.hasPractical,
        }));
      }),
    );

    const groupMap = new Map<string, DraftElective[]>();
    for (const el of draft.electives) {
      const arr = groupMap.get(el.group) ?? [];
      arr.push(el);
      groupMap.set(el.group, arr);
    }

    let gIdx = 1;
    const elective_groups = Array.from(groupMap.entries()).map(([grp, options]) => ({
      group_id: gIdx++,
      name: grp === "ELECTIVE_I" ? "Elective I" : grp === "ELECTIVE_II" ? "Elective II" : grp,
      target_semester: grp === "ELECTIVE_II" ? 8 : 7,
      required_credits: 3,
      options: options.map((opt) => ({
        code: opt.code || null,
        name: opt.name,
        credits: opt.credits,
      })),
    }));

    const exportData = {
      program: selectedProgram?.code || "CURRICULUM",
      courses,
      elective_groups,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProgram?.code || "curriculum"}_structure.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Curriculum JSON exported successfully.");
  }

  function parseCurriculumJson(jsonContent: string): Draft {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new Error("File contains invalid JSON syntax.");
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (parsed.curriculum) parsed = parsed.curriculum;
      else if (parsed.data) parsed = parsed.data;
    }

    // 1. Support the new flexible & functional format:
    // { courses: [ { code, name, credits, year, semester, type, hasTheory, hasPractical } ], elective_groups: [ ... ] }
    const rawCourseList = Array.isArray(parsed?.courses)
      ? parsed.courses
      : Array.isArray(parsed) &&
        parsed.length > 0 &&
        (parsed[0].semester !== undefined || parsed[0].semesterNo !== undefined)
      ? parsed
      : null;

    if (rawCourseList) {
      const yearMap = new Map<number, Map<number, DraftCourse[]>>();

      for (const item of rawCourseList) {
        const semNo = Number(item.semester ?? item.semesterNo ?? 1) || 1;
        const yearNo = Number(item.year) > 0 ? Number(item.year) : Math.ceil(semNo / 2) || 1;

        if (!yearMap.has(yearNo)) yearMap.set(yearNo, new Map());
        const semMap = yearMap.get(yearNo)!;
        if (!semMap.has(semNo)) semMap.set(semNo, []);

        const code = String(item.code || item.courseCode || "").trim().toUpperCase();
        const name = String(item.name || item.title || item.courseName || "").trim();
        if (!name) continue;

        const credits = Number.isFinite(Number(item.credits ?? item.credit))
          ? Number(item.credits ?? item.credit)
          : 3;

        const valTh = item.hasTheory ?? item.th ?? item.theory;
        const valPr = item.hasPractical ?? item.pr ?? item.practical;

        let hasTheory = valTh !== undefined ? Boolean(valTh) : true;
        let hasPractical = valPr !== undefined ? Boolean(valPr) : false;

        const typeStr = String(item.type || "").toLowerCase();
        if (typeStr === "practical" || typeStr === "lab") {
          if (valTh === undefined) hasTheory = false;
          hasPractical = true;
        } else if (typeStr === "theory" && valPr === undefined) {
          hasPractical = false;
        }

        if (!hasTheory && !hasPractical) hasTheory = true;

        semMap.get(semNo)!.push({ code, name, credits, hasTheory, hasPractical });
      }

      const generatedYears: DraftYear[] = [];
      const sortedYearKeys = Array.from(yearMap.keys()).sort((a, b) => a - b);
      for (const yNo of sortedYearKeys) {
        const semMap = yearMap.get(yNo)!;
        const sortedSemKeys = Array.from(semMap.keys()).sort((a, b) => a - b);
        const sems: DraftSemester[] = sortedSemKeys.map((sNo) => ({
          label: `Semester ${sNo}`,
          courses: semMap.get(sNo)!,
        }));
        generatedYears.push({
          label: `Year ${yNo}`,
          semesters: sems,
        });
      }

      // Parse elective_groups or electives
      const parsedElectives: DraftElective[] = [];
      const rawElectiveGroups = Array.isArray(parsed?.elective_groups)
        ? parsed.elective_groups
        : Array.isArray(parsed?.electives)
        ? parsed.electives
        : [];

      for (const grp of rawElectiveGroups) {
        if (Array.isArray(grp.options)) {
          // Group object: { group_id: 1, name: "...", options: [...] }
          const rawGroup = String(grp.name || grp.group || (grp.group_id ? `ELECTIVE_${grp.group_id}` : "ELECTIVE_I")).trim().toUpperCase();
          const group: DraftElective["group"] =
            rawGroup.includes("II") || rawGroup.includes("2") ? "ELECTIVE_II" : "ELECTIVE_I";

          for (const opt of grp.options) {
            const name = String(opt.name || opt.title || "").trim();
            if (!name) continue;
            const code = String(opt.code || "").trim().toUpperCase();
            const credits = Number.isFinite(Number(opt.credits ?? opt.credit))
              ? Number(opt.credits ?? opt.credit)
              : 3;
            parsedElectives.push({ group, code, name, credits });
          }
        } else if (grp && typeof grp === "object") {
          // Flat elective item: { group: "ELECTIVE_I", code: "...", name: "..." }
          const rawGroup = String(grp.group || "ELECTIVE_I").trim().toUpperCase();
          const group: DraftElective["group"] =
            rawGroup.includes("II") || rawGroup.includes("2") ? "ELECTIVE_II" : "ELECTIVE_I";
          const code = String(grp.code || "").trim().toUpperCase();
          const name = String(grp.name || grp.title || "").trim();
          const credits = Number.isFinite(Number(grp.credits ?? grp.credit))
            ? Number(grp.credits ?? grp.credit)
            : 3;
          if (name) {
            parsedElectives.push({ group, code, name, credits });
          }
        }
      }

      if (generatedYears.length === 0) {
        throw new Error("No valid courses found in JSON.");
      }

      return {
        years: generatedYears,
        electives: parsedElectives,
      };
    }

    throw new Error(
      'Invalid curriculum JSON format. The JSON must contain a "courses" array, e.g. { "courses": [{ "code": "AR111", "name": "Basic Design I", "credits": 4, "year": 1, "semester": 1, "type": "core" }], "elective_groups": [...] }',
    );
  }

  async function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const newDraft = parseCurriculumJson(text);
      const totalCourses = newDraft.years.reduce(
        (sum, y) => sum + y.semesters.reduce((sSum, s) => sSum + s.courses.length, 0),
        0,
      );

      setDraft(newDraft);
      toast.success(
        `Imported ${newDraft.years.length} years and ${totalCourses} courses from JSON. Review and click "Save & Publish".`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to parse curriculum JSON file.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // ─── Save & Publish ──────────────────────────────────────────────
  async function handleSave() {
    if (!programId) return;

    // Client-side validation: check for invalid courses
    for (const y of draft.years) {
      for (const s of y.semesters) {
        for (const c of s.courses) {
          if (!c.name.trim()) {
            toast.error("Every course must have a title.");
            return;
          }
          if (!c.hasTheory && !c.hasPractical) {
            toast.error(`Course "${c.name}" must have at least Theory (TH) or Practical (PR) enabled.`);
            return;
          }
        }
      }
    }

    let globalSem = 0;
    const courses = draft.years.flatMap((y, yIdx) =>
      y.semesters.flatMap((s) => {
        globalSem += 1;
        return s.courses.map((c) => ({
          code: c.code || null,
          name: c.name,
          credits: c.credits,
          year: yIdx + 1,
          semester: globalSem,
          type: c.hasPractical && !c.hasTheory ? "practical" : "core",
          hasTheory: c.hasTheory,
          hasPractical: c.hasPractical,
        }));
      }),
    );

    const groupMap = new Map<string, DraftElective[]>();
    for (const el of draft.electives) {
      const arr = groupMap.get(el.group) ?? [];
      arr.push(el);
      groupMap.set(el.group, arr);
    }

    let gIdx = 1;
    const elective_groups = Array.from(groupMap.entries()).map(([grp, options]) => ({
      group_id: gIdx++,
      name: grp === "ELECTIVE_I" ? "Elective I" : grp === "ELECTIVE_II" ? "Elective II" : grp,
      options: options.map((opt) => ({
        code: opt.code || null,
        name: opt.name,
        credits: opt.credits,
      })),
    }));

    setError("");
    setSaving(true);
    startProgress();
    try {
      const res = await fetch("/api/curriculum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          courses,
          elective_groups,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to save curriculum");
        toast.error(data.error ?? "Unable to save curriculum");
        return;
      }
      setHasCurriculum(true);
      setOriginalDraft(JSON.parse(JSON.stringify(draft)));
      setSaveTimestamp(Date.now());
      toast.success("Curriculum published successfully!");
    } catch {
      setError("Unable to reach the server");
      toast.error("Network error while saving curriculum");
    } finally {
      setSaving(false);
      doneProgress();
    }
  }

  // ─── Filtered Years for Builder ──────────────────────────────────
  const filteredYears = useMemo(() => {
    let list = draft.years.map((y, originalIdx) => ({
      ...y,
      originalIndex: originalIdx,
    }));

    if (yearFilter !== "ALL") {
      list = list.filter((_, idx) => idx + 1 === yearFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list
        .map((year) => ({
          ...year,
          semesters: year.semesters
            .map((sem) => ({
              ...sem,
              courses: sem.courses.filter(
                (c) =>
                  c.code.toLowerCase().includes(q) ||
                  c.name.toLowerCase().includes(q),
              ),
            }))
            .filter((sem) => sem.courses.length > 0),
        }))
        .filter((year) => year.semesters.length > 0);
    }

    return list;
  }, [draft.years, yearFilter, searchQuery]);

  // Toggle year collapse
  function toggleYearCollapse(yearIdx: number) {
    setCollapsedYears((prev) => ({
      ...prev,
      [yearIdx]: !prev[yearIdx],
    }));
  }

  function setAllCollapsed(collapsed: boolean) {
    const next: Record<number, boolean> = {};
    draft.years.forEach((_, i) => {
      next[i] = collapsed;
    });
    setCollapsedYears(next);
  }

  if (loading) {
    return (
      <AdminShell
        title="Curriculum"
        subtitle="Course Structure Management"
        active="/admin/curriculum"
      >
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Curriculum"
      subtitle="Course Structure Management"
      active="/admin/curriculum"
    >
      <div className="flex flex-col gap-5">
        {/* ── Top Header Card: Program Selector & Quick Actions ── */}
        <Card className="rounded-xl border border-border/70 p-3.5 sm:p-4 shadow-xs bg-card">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Hidden file input for JSON import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />

            {/* Program Picker with clean status */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-full sm:w-80">
                <Select
                  value={programId}
                  onValueChange={setProgramId}
                  disabled={loading || programs.length === 0}
                >
                  <SelectTrigger id="program-select" className="h-9 text-xs font-semibold">
                    <IconLayersLinked size={15} className="text-primary mr-1.5 shrink-0" />
                    <SelectValue placeholder={programs.length === 0 ? "No programs" : "Select program..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <span className="font-bold">{p.code}</span> — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProgram && (
                <div className="flex items-center gap-2 shrink-0">
                  {isDirty ? (
                    <Badge className="text-xs py-0.5 px-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 font-semibold animate-pulse">
                      ● Unsaved Changes
                    </Badge>
                  ) : hasCurriculum ? (
                    <Badge className="text-xs py-0.5 px-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0 font-semibold">
                      <IconCheck size={12} className="mr-1 inline" />
                      Published
                    </Badge>
                  ) : (
                    <Badge className="text-xs py-0.5 px-2 bg-sky-500/15 text-sky-700 dark:text-sky-400 border-0 font-semibold">
                      Draft
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadSampleCurriculumJson}
                className="h-8.5 gap-1.5 text-xs font-semibold"
                title="Download sample JSON template"
              >
                <IconDownload size={14} />
                <span>Sample JSON</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8.5 gap-1.5 text-xs font-semibold"
                title="Upload JSON file to populate curriculum"
              >
                <IconUpload size={14} />
                <span>Import JSON</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportCurriculumJson}
                disabled={draft.years.length === 0}
                className="h-8.5 gap-1.5 text-xs font-semibold"
                title="Export current curriculum as functional JSON"
              >
                <IconDownload size={14} />
                <span>Export JSON</span>
              </Button>


              {isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscard}
                  className="h-8.5 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconArrowBackUp size={14} />
                  <span>Discard</span>
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || loadingCurriculum}
                className={cn(
                  "h-8.5 gap-1.5 text-xs font-semibold transition-all",
                  isDirty ? "shadow-sm shadow-primary/20" : "",
                )}
              >
                {saving ? (
                  <>
                    <IconLoader2 size={14} className="animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <IconDeviceFloppy size={14} />
                    <span>Save & Publish</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Error notification */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
            <IconAlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Tabs: Curriculum Builder vs Student View Preview ── */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "builder" | "preview")}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2.5">
            <TabSwitcher
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  id: "builder",
                  label: "Curriculum Builder",
                  icon: IconPencil,
                },
                {
                  id: "preview",
                  label: "Course Structure Preview",
                  icon: IconEye,
                },
              ]}
            />

            {/* Quick Helper Text */}
            <span className="text-xs text-muted-foreground hidden md:inline-block">
              {activeTab === "builder"
                ? "Interactive curriculum design: configure years, semesters, credits & courses"
                : "Live student & faculty visualization matching the academic portal"}
            </span>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 1: CURRICULUM BUILDER                                  */}
          {/* ══════════════════════════════════════════════════════════ */}
          <TabsContent value="builder" className="m-0 outline-hidden space-y-5">
            {/* Filter & Search Bar */}
            <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Year Filter Pills */}
                <div className="inline-flex flex-wrap rounded-xl border border-border/70 p-1 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setYearFilter("ALL")}
                    className={cn(
                      "px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer",
                      yearFilter === "ALL"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All Years ({draft.years.length})
                  </button>
                  {draft.years.map((y, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setYearFilter(idx + 1)}
                      className={cn(
                        "px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer",
                        yearFilter === idx + 1
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {y.label || `Year ${idx + 1}`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {/* Search Box */}
                  <div className="relative w-full sm:w-64">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Find course by name or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-xs sm:text-sm h-9"
                    />
                  </div>

                  {/* Add Year Button */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={addYear}
                    className="h-9 gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                    title="Add a new academic year to curriculum"
                  >
                    <IconPlus size={14} />
                    <span>Add Year</span>
                  </Button>

                  {/* Expand/Collapse All Buttons */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const anyCollapsed = Object.values(collapsedYears).some(Boolean);
                      setAllCollapsed(!anyCollapsed);
                    }}
                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                    title="Toggle Expand All / Collapse All"
                  >
                    {Object.values(collapsedYears).some(Boolean) ? (
                      <>
                        <IconChevronDown size={14} className="mr-1" />
                        Expand
                      </>
                    ) : (
                      <>
                        <IconChevronUp size={14} className="mr-1" />
                        Collapse
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Loading skeleton */}
            {loadingCurriculum && (
              <div className="space-y-4">
                <Skeleton className="h-44 w-full rounded-xl" />
                <Skeleton className="h-44 w-full rounded-xl" />
              </div>
            )}

            {/* ── Empty State: No Curriculum Draft ── */}
            {!loadingCurriculum && draft.years.length === 0 && (
              <Card className="rounded-xl border-dashed border-2 p-10 text-center bg-card/60">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <IconBook2 size={24} />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  No Curriculum Defined Yet
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-5">
                  Get started manually by adding your first academic year or import a curriculum JSON file.
                </p>

                <div className="flex items-center justify-center">
                  <Button
                    type="button"
                    onClick={addYear}
                    className="gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <IconPlus size={15} />
                    Add Year
                  </Button>
                </div>
              </Card>
            )}

            {/* ── Years / Semesters / Courses Editor List ── */}
            {!loadingCurriculum && filteredYears.length > 0 && (
              <div className="space-y-6">
                {filteredYears.map((year) => {
                  const yi = year.originalIndex;
                  const isCollapsed = collapsedYears[yi];

                  // Year metrics
                  const yearCredits = year.semesters.reduce(
                    (ySum, s) =>
                      ySum +
                      s.courses.reduce(
                        (sSum, c) => sSum + (Number.isFinite(c.credits) ? c.credits : 0),
                        0,
                      ),
                    0,
                  );
                  const yearCourseCount = year.semesters.reduce(
                    (sum, s) => sum + s.courses.length,
                    0,
                  );

                  return (
                    <Card
                      key={`year-${yi}`}
                      className="rounded-xl border border-border/70 shadow-xs bg-card overflow-hidden"
                    >
                      {/* Year Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-muted/25">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* Year Number Badge */}
                          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                            {yi + 1}
                          </span>

                          {/* Editable Year Label */}
                          <Input
                            value={year.label}
                            onChange={(e) => updateYearLabel(yi, e.target.value)}
                            placeholder={`Year ${yi + 1}`}
                            aria-label="Year label"
                            className="font-bold text-sm h-8 max-w-64 bg-background/80"
                          />

                          {/* Year quick stats */}
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[11px] font-semibold bg-background">
                              {year.semesters.length} Semesters
                            </Badge>
                            <Badge variant="secondary" className="text-[11px] font-mono font-bold">
                              {yearCredits} cr
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addSemester(yi)}
                            className="h-8 gap-1 text-xs font-semibold"
                          >
                            <IconPlus size={14} />
                            Add Semester
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remove Year"
                            onClick={() => {
                              if (
                                year.semesters.length > 0 &&
                                !confirm(`Are you sure you want to remove ${year.label}? All containing semesters and courses will be deleted.`)
                              ) {
                                return;
                              }
                              removeYear(yi);
                            }}
                            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <IconTrash size={15} />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleYearCollapse(yi)}
                            className="size-8 text-muted-foreground hover:text-foreground"
                            title={isCollapsed ? "Expand Year" : "Collapse Year"}
                          >
                            {isCollapsed ? (
                              <IconChevronDown size={16} />
                            ) : (
                              <IconChevronUp size={16} />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Year Card Body: Semesters Grid */}
                      {!isCollapsed && (
                        <CardContent className="p-4 sm:p-5 space-y-5">
                          {year.semesters.length === 0 ? (
                            <p className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                              No semesters in this year yet. Click “Add Semester” above to add one.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              {year.semesters.map((sem, si) => {
                                const semCredits = sem.courses.reduce(
                                  (sum, c) =>
                                    sum + (Number.isFinite(c.credits) ? c.credits : 0),
                                  0,
                                );

                                return (
                                  <div
                                    key={`sem-${yi}-${si}`}
                                    className="rounded-xl border border-border/70 overflow-hidden bg-card shadow-2xs flex flex-col justify-between"
                                  >
                                    {/* Semester Header */}
                                    <div>
                                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/60 bg-muted/20">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <Input
                                            value={sem.label}
                                            onChange={(e) =>
                                              updateSemesterLabel(yi, si, e.target.value)
                                            }
                                            placeholder="Semester label"
                                            aria-label="Semester label"
                                            className="font-bold text-xs h-7.5 max-w-44 bg-background/80"
                                          />
                                          <Badge
                                            variant="secondary"
                                            className="font-mono text-[10px] font-bold px-1.5 py-0.5"
                                          >
                                            {sem.courses.length} c · {semCredits} cr
                                          </Badge>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addCourse(yi, si)}
                                            className="h-7 px-2 text-[11px] font-semibold gap-1"
                                          >
                                            <IconPlus size={13} />
                                            Course
                                          </Button>

                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            title="Remove semester"
                                            onClick={() => {
                                              if (
                                                sem.courses.length > 0 &&
                                                !confirm(`Remove ${sem.label}?`)
                                              ) {
                                                return;
                                              }
                                              removeSemester(yi, si);
                                            }}
                                            className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                          >
                                            <IconTrash size={14} />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Courses Table / List */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead>
                                            <tr className="border-b border-border/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/10">
                                              <th className="py-2 px-2.5 w-24">Code</th>
                                              <th className="py-2 px-2.5">Title</th>
                                              <th className="py-2 px-2 w-16 text-center">Cr</th>
                                              <th className="py-2 px-2 w-28 text-center">Type</th>
                                              <th className="py-2 px-2 w-8 text-center"></th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/40">
                                            {sem.courses.length === 0 ? (
                                              <tr>
                                                <td
                                                  colSpan={5}
                                                  className="py-6 text-center text-xs text-muted-foreground/70"
                                                >
                                                  No courses yet. Click “+ Course” to add one.
                                                </td>
                                              </tr>
                                            ) : (
                                              sem.courses.map((course, ci) => (
                                                <tr
                                                  key={`course-${yi}-${si}-${ci}`}
                                                  className="hover:bg-muted/15 transition-colors group"
                                                >
                                                  {/* Code Input */}
                                                  <td className="py-1.5 px-2.5 align-middle">
                                                    <Input
                                                      value={course.code}
                                                      onChange={(e) =>
                                                        updateCourse(yi, si, ci, {
                                                          code: e.target.value.toUpperCase(),
                                                        })
                                                      }
                                                      placeholder="e.g. CS101"
                                                      aria-label="Course code"
                                                      className="h-7.5 font-mono text-[11px] font-bold uppercase"
                                                    />
                                                  </td>

                                                  {/* Title Input */}
                                                  <td className="py-1.5 px-2.5 align-middle">
                                                    <Input
                                                      value={course.name}
                                                      onChange={(e) =>
                                                        updateCourse(yi, si, ci, {
                                                          name: e.target.value,
                                                        })
                                                      }
                                                      placeholder="Course title..."
                                                      aria-label="Course title"
                                                      className="h-7.5 text-xs font-medium"
                                                    />
                                                  </td>

                                                  {/* Credits Input */}
                                                  <td className="py-1.5 px-2 align-middle">
                                                    <Input
                                                      type="number"
                                                      min={0}
                                                      max={30}
                                                      value={
                                                        Number.isFinite(course.credits)
                                                          ? course.credits
                                                          : ""
                                                      }
                                                      onChange={(e) =>
                                                        updateCourse(yi, si, ci, {
                                                          credits: Number(e.target.value),
                                                        })
                                                      }
                                                      placeholder="3"
                                                      aria-label="Credits"
                                                      className="h-7.5 w-14 text-center font-mono text-xs mx-auto"
                                                    />
                                                  </td>

                                                  {/* Theory & Practical Toggle Pills */}
                                                  <td className="py-1.5 px-2 align-middle">
                                                    <div className="flex items-center justify-center gap-1">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          if (course.hasTheory && !course.hasPractical) {
                                                            toast.warning("Course must have at least Theory or Practical");
                                                            return;
                                                          }
                                                          updateCourse(yi, si, ci, {
                                                            hasTheory: !course.hasTheory,
                                                          });
                                                        }}
                                                        className={cn(
                                                          "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer",
                                                          course.hasTheory
                                                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-2xs"
                                                            : "bg-muted/40 text-muted-foreground/60 border-border/50 hover:bg-muted"
                                                        )}
                                                        title="Toggle Theory (TH)"
                                                      >
                                                        TH
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          if (course.hasPractical && !course.hasTheory) {
                                                            toast.warning("Course must have at least Theory or Practical");
                                                            return;
                                                          }
                                                          updateCourse(yi, si, ci, {
                                                            hasPractical: !course.hasPractical,
                                                          });
                                                        }}
                                                        className={cn(
                                                          "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer",
                                                          course.hasPractical
                                                            ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40 shadow-2xs"
                                                            : "bg-muted/40 text-muted-foreground/60 border-border/50 hover:bg-muted"
                                                        )}
                                                        title="Toggle Practical (PR)"
                                                      >
                                                        PR
                                                      </button>
                                                    </div>
                                                  </td>

                                                  {/* Delete Action */}
                                                  <td className="py-1.5 px-2 align-middle text-center">
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={() => removeCourse(yi, si, ci)}
                                                      className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                      title="Remove course"
                                                    >
                                                      <IconTrash size={13} />
                                                    </Button>
                                                  </td>
                                                </tr>
                                              ))
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* Semester Footer Summary */}
                                    <div className="px-3.5 py-2 border-t border-border/50 bg-muted/10 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                                      <span>Total Semester Credits</span>
                                      <span className="font-bold font-mono text-foreground">
                                        {semCredits} Credits
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ── Electives Builder Section ── */}
            {!loadingCurriculum && (
              <Card className="rounded-xl border border-border/70 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                          ★
                        </span>
                        Program Electives
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Define elective course options that students can select throughout the degree.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(["ELECTIVE_I", "ELECTIVE_II"] as const).map((group) => {
                      const items = draft.electives.filter((e) => e.group === group);
                      const groupLabel =
                        group === "ELECTIVE_I" ? "Elective I" : "Elective II";

                      return (
                        <div
                          key={group}
                          className="rounded-xl border border-border/70 overflow-hidden bg-card"
                        >
                          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/20">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">
                                {groupLabel}
                              </span>
                              <Badge variant="outline" className="text-[10px] bg-background">
                                Choice of 1 Course
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addElective(group)}
                              className="h-7 px-2 text-[11px] font-semibold gap-1"
                            >
                              <IconPlus size={13} />
                              Add Option
                            </Button>
                          </div>

                          <div className="p-3 space-y-2">
                            {items.length === 0 ? (
                              <p className="py-4 text-center text-xs text-muted-foreground/70 border border-dashed rounded-lg">
                                No elective options added yet. Click “Add Option” above.
                              </p>
                            ) : (
                              items.map((item) => {
                                const realIndex = draft.electives.indexOf(item);
                                return (
                                  <div
                                    key={`${group}-${realIndex}`}
                                    className="flex items-center gap-2 bg-muted/15 p-1.5 rounded-lg border border-border/40"
                                  >
                                    <Input
                                      value={item.code}
                                      onChange={(e) =>
                                        updateElective(realIndex, {
                                          code: e.target.value.toUpperCase(),
                                        })
                                      }
                                      placeholder="Code"
                                      aria-label={`${group} code`}
                                      className="h-7.5 w-24 font-mono text-[11px] font-bold uppercase"
                                    />
                                    <Input
                                      value={item.name}
                                      onChange={(e) =>
                                        updateElective(realIndex, {
                                          name: e.target.value,
                                        })
                                      }
                                      placeholder="Elective course title..."
                                      aria-label={`${group} name`}
                                      className="h-7.5 flex-1 text-xs font-medium"
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      value={item.credits}
                                      onChange={(e) =>
                                        updateElective(realIndex, {
                                          credits: Number(e.target.value),
                                        })
                                      }
                                      placeholder="Cr"
                                      aria-label={`${group} credits`}
                                      className="h-7.5 w-14 text-center font-mono text-xs"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Remove elective"
                                      onClick={() => removeElective(realIndex)}
                                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                    >
                                      <IconTrash size={14} />
                                    </Button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 2: COURSE STRUCTURE PREVIEW (Reusing Academic Panel)   */}
          {/* ══════════════════════════════════════════════════════════ */}
          <TabsContent value="preview" className="m-0 outline-hidden space-y-4">
            {/* Context Notification Banner */}
            <Card className="rounded-xl border border-border/70 p-3.5 bg-linear-to-r from-primary/5 via-card to-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <IconEye size={18} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                    Live Student & Faculty Course Structure
                  </h4>
                  <p className="text-[11px] sm:text-xs text-muted-foreground">
                    This view uses the identical student component to render your published degree structure.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("builder")}
                  className="gap-1.5 text-xs font-semibold h-8"
                >
                  <IconPencil size={14} />
                  Edit in Builder
                </Button>
              </div>
            </Card>

            {/* Embedded StudentCourseStructurePanel */}
            <StudentCourseStructurePanel
              key={`${programId}-${saveTimestamp}`}
              defaultProgramId={programId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}