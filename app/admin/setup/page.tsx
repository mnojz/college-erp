"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminShell } from "@/app/components/admin/AdminShell";
import { ProgressionCard } from "@/app/components/admin/ProgressionCard";
import { BulkIntakeCard } from "@/app/components/admin/BulkIntakeCard";
import { AdminModal } from "@/app/components/admin/AdminModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabSwitcher } from "@/app/components/common/TabSwitcher";
import {
  IconAlertTriangle,
  IconArchive,
  IconArchiveOff,
  IconArrowUpRight,
  IconBook2,
  IconBriefcase,
  IconClock,
  IconCloudUpload,
  IconPencil,
  IconPlus,
  IconSchool,
  IconSearch,
  IconTrash,
  IconTrendingUp,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type Department = {
  id: string;
  name: string;
  code: string;
  programCount: number;
};

type Program = {
  id: string;
  name: string;
  code: string;
  departmentName: string;
  durationYears: number;
  /** Set when the program is archived — hidden from pickers, never deleted. */
  archivedAt?: string | null;
};

const programEmpty = { name: "", code: "", durationYears: "4" };

/** Derive a short department code from its name, e.g. "Computer Science" → "CS". */
function suggestDeptCode(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w) => w[0].toUpperCase()).join("").slice(0, 4);
  }
  return name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

export default function AdminSetupPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<"programs" | "progression" | "intake">("programs");

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");

  // Program modals
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [editingProgram, setEditingProgram] = useState<(Program & { durationYearsStr: string }) | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<Program | null>(null);
  const [programForm, setProgramForm] = useState(programEmpty);

  // Department modal
  const [deptForm, setDeptForm] = useState({ name: "", code: "" });
  const [showSetDept, setShowSetDept] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [pRes, dRes] = await Promise.all([
      fetch("/api/programs?includeArchived=1"),
      fetch("/api/departments"),
    ]);
    const [pData, dData] = await Promise.all([pRes.json(), dRes.json()]);
    setPrograms(pData.programs ?? []);
    setDepartment(dData.department ?? null);
  }

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok || (await me.json()).user.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        await refresh();
      } catch {
        setError("Unable to load academic structure");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  /* ── Department Handlers ───────────────────────────────────── */

  async function handleSetDept(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const updating = Boolean(department);
    try {
      const res = await fetch("/api/departments", {
        method: updating ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deptForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to save department");
        return;
      }
      await refresh();
      setShowSetDept(false);
      toast.success(
        updating
          ? "Department updated successfully. Its new name/code is synchronized across the portal."
          : `Department ${data.department.code} initialized successfully.`,
      );
    } catch {
      setError("Unable to submit department");
    } finally {
      setSaving(false);
    }
  }

  /* ── Program Handlers ───────────────────────────────────────── */

  async function handleCreateProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...programForm, durationYears: Number(programForm.durationYears) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to create program");
        return;
      }
      await refresh();
      setProgramForm(programEmpty);
      setShowCreateProgram(false);
      toast.success(`Degree program ${data.program.code} created successfully.`);
    } catch {
      setError("Unable to submit program");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingProgram) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProgram.id,
          name: editingProgram.name,
          code: editingProgram.code,
          durationYears: Number(editingProgram.durationYearsStr),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to update program");
        return;
      }
      await refresh();
      setEditingProgram(null);
      toast.success(`Degree program ${data.program.code} updated successfully.`);
    } catch {
      setError("Unable to update program");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveProgram(p: Program, archived: boolean) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, archived }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to update program status");
        return;
      }
      await refresh();
      toast.success(
        archived
          ? `Program ${p.code} archived. Historical records remain fully preserved.`
          : `Program ${p.code} restored and active again.`,
      );
    } catch {
      setError("Unable to reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProgram() {
    if (!deletingProgram) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/programs?id=${deletingProgram.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to delete program");
        toast.error(data.error ?? "Unable to delete program");
        return;
      }
      await refresh();
      toast.success(`Program ${deletingProgram.code} has been permanently deleted.`);
      setDeletingProgram(null);
    } catch {
      setError("Unable to delete program");
      toast.error("Unable to delete program");
    } finally {
      setSaving(false);
    }
  }

  // Filtered program records
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      if (statusFilter === "ACTIVE" && p.archivedAt) return false;
      if (statusFilter === "ARCHIVED" && !p.archivedAt) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const codeMatch = p.code.toLowerCase().includes(query);
        const nameMatch = p.name.toLowerCase().includes(query);
        const durMatch = `${p.durationYears} years`.includes(query);
        return codeMatch || nameMatch || durMatch;
      }
      return true;
    });
  }, [programs, statusFilter, searchQuery]);

  const activeCount = programs.filter((p) => !p.archivedAt).length;
  const archivedCount = programs.filter((p) => p.archivedAt).length;

  return (
    <AdminShell
      title="Department & Programs"
      subtitle="Academic hierarchy, degree programs, and cohorts"
      active="/admin/setup"
    >
      <div className="space-y-6">
        {/* Error notification */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
            <IconAlertTriangle className="size-4.5 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* ── 1. Department Hero / Identity Banner ─────────────────────── */}
        {loading ? (
          <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
        ) : department ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
                  <IconSchool size={22} />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      {department.name} Department
                    </h2>
                    <Badge className="font-mono text-xs font-bold px-2 py-0.5 bg-primary/15 text-primary border-0">
                      {department.code}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Central academic unit coordinating degree programs and cohorts.
                  </p>
                </div>
              </div>

              {/* Department Quick Stats & Edit Action */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-start sm:self-center">
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/70 bg-background/60 text-xs">
                  <span className="text-muted-foreground font-medium">Active Programs:</span>
                  <span className="font-bold text-foreground tabular-nums">{activeCount}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 h-8.5 rounded-xl border-border/80 bg-background hover:bg-accent/60 font-medium cursor-pointer text-xs"
                  onClick={() => {
                    setDeptForm({ name: department.name, code: department.code });
                    setError("");
                    setShowSetDept(true);
                  }}
                >
                  <IconPencil size={14} />
                  <span>Edit Department</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 text-center space-y-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary mx-auto">
              <IconSchool size={20} />
            </span>
            <div className="max-w-md mx-auto">
              <h3 className="text-sm font-bold text-foreground">
                Set up your academic department
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure your institution&apos;s department name and code to anchor degree programs.
              </p>
            </div>
            <Button
              size="sm"
              type="button"
              className="rounded-xl h-8.5 px-3.5 gap-1.5 font-semibold text-xs"
              onClick={() => {
                setDeptForm({ name: "", code: "" });
                setShowSetDept(true);
                setError("");
              }}
            >
              <IconPlus size={15} />
              <span>Initialize Department</span>
            </Button>
          </div>
        )}

        {/* ── 2. Tabbed Academic Operations Hub ────────────────────────── */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as typeof activeTab)}
          className="space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <TabSwitcher
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                {
                  id: "programs",
                  label: "Degree Programs",
                  icon: IconSchool,
                  badge: programs.length,
                },
                {
                  id: "progression",
                  label: "Cohort Progression",
                  icon: IconTrendingUp,
                },
                {
                  id: "intake",
                  label: "Batch Student Intake",
                  icon: IconCloudUpload,
                },
              ]}
            />
          </div>

          {/* ════ TAB 1: DEGREE PROGRAMS ════ */}
          <TabsContent value="programs" className="space-y-4 m-0 outline-hidden">
            {/* Search & Actions Toolbar */}
            <Card className="rounded-xl border border-border/70 shadow-xs bg-card p-3 sm:p-3.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search query input */}
                <div className="relative flex-1 min-w-48">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by program name, code (e.g. BCA, BCT), duration..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8.5 rounded-lg"
                  />
                </div>

                {/* Status Toggle & Add Program Action */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ALL")}
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                        statusFilter === "ALL"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      All ({programs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ACTIVE")}
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                        statusFilter === "ACTIVE"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Active ({activeCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ARCHIVED")}
                      className={cn(
                        "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                        statusFilter === "ARCHIVED"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Archived ({archivedCount})
                    </button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    className="h-8.5 px-3 rounded-lg text-xs font-semibold gap-1.5 shrink-0 cursor-pointer shadow-xs"
                    onClick={() => {
                      setShowCreateProgram(true);
                      setError("");
                    }}
                  >
                    <IconPlus size={14} />
                    <span>Add Program</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Programs Table */}
            <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-28 text-xs font-bold uppercase tracking-wider">
                      Program Code
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">
                      Degree Title
                    </TableHead>
                    <TableHead className="w-36 text-xs font-bold uppercase tracking-wider">
                      Duration
                    </TableHead>
                    <TableHead className="w-36 text-xs font-bold uppercase tracking-wider">
                      Total Semesters
                    </TableHead>
                    <TableHead className="w-32 text-xs font-bold uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="w-32 text-right text-xs font-bold uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredPrograms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-2">
                          <IconSchool className="size-8 text-muted-foreground/40" />
                          <p className="text-sm font-semibold text-foreground">
                            No degree programs match your filter
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {searchQuery
                              ? "Try adjusting your search query or clear the filter."
                              : "Get started by adding your first degree program."}
                          </p>
                          {searchQuery && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 text-xs"
                              onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("ALL");
                              }}
                            >
                              Reset Search
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPrograms.map((p) => {
                      const isArchived = Boolean(p.archivedAt);

                      return (
                        <TableRow
                          key={p.id}
                          className={cn(
                            "transition-colors",
                            isArchived && "opacity-60 bg-muted/15"
                          )}
                        >
                          {/* Program Code */}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-mono text-xs font-bold bg-primary/10 text-primary border-primary/20 px-2 py-0.5"
                            >
                              {p.code}
                            </Badge>
                          </TableCell>

                          {/* Degree Title & Shortcut */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-xs sm:text-sm">
                                {p.name}
                              </span>
                              <Link
                                href="/admin/curriculum"
                                className="text-[11px] font-medium text-primary/80 hover:text-primary hover:underline inline-flex items-center gap-0.5"
                                title="View curriculum syllabus"
                              >
                                <span>Curriculum</span>
                                <IconArrowUpRight size={12} />
                              </Link>
                            </div>
                          </TableCell>

                          {/* Duration */}
                          <TableCell>
                            <span className="text-xs font-medium text-foreground">
                              {p.durationYears} {p.durationYears === 1 ? "Year" : "Years"}
                            </span>
                          </TableCell>

                          {/* Semesters */}
                          <TableCell>
                            <Badge className="text-xs font-semibold bg-primary/15 text-primary border-0">
                              {p.durationYears * 2} Semesters
                            </Badge>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            {isArchived ? (
                              <Badge className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border-0">
                                Archived
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-0">
                                Active
                              </Badge>
                            )}
                          </TableCell>

                          {/* Action Buttons */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8 rounded-lg cursor-pointer"
                                title="Edit Program"
                                aria-label="Edit Program"
                                onClick={() => {
                                  setError("");
                                  setEditingProgram({ ...p, durationYearsStr: String(p.durationYears) });
                                }}
                              >
                                <IconPencil size={14} />
                              </Button>

                              {isArchived ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="size-8 rounded-lg cursor-pointer"
                                  title="Restore Program"
                                  aria-label="Restore Program"
                                  disabled={saving}
                                  onClick={() => void handleArchiveProgram(p, false)}
                                >
                                  <IconArchiveOff size={14} />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-8 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                                    title="Archive Program — hides it from pickers without deleting records"
                                    aria-label="Archive Program"
                                    disabled={saving}
                                    onClick={() => void handleArchiveProgram(p, true)}
                                  >
                                    <IconArchive size={14} />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-8 rounded-lg cursor-pointer border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                                    title="Delete permanently — allowed only if unused"
                                    aria-label="Delete Program"
                                    disabled={saving}
                                    onClick={() => {
                                      setError("");
                                      setDeletingProgram(p);
                                    }}
                                  >
                                    <IconTrash size={14} />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ════ TAB 2: COHORT PROGRESSION ════ */}
          <TabsContent value="progression" className="space-y-4 m-0 outline-hidden">
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 text-xs text-muted-foreground flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconTrendingUp size={16} />
              </span>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  Academic Term Semester Progression
                </p>
                <p className="mt-0.5">
                  Advance active student cohorts from Semester N to Semester N+1 at the conclusion of each term.
                  Final semester cohorts are securely recorded into graduation records.
                </p>
              </div>
            </div>
            <ProgressionCard />
          </TabsContent>

          {/* ════ TAB 3: BATCH STUDENT INTAKE ════ */}
          <TabsContent value="intake" className="space-y-4 m-0 outline-hidden">
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 text-xs text-muted-foreground flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconCloudUpload size={16} />
              </span>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  Standardized CSV Student Enrollment
                </p>
                <p className="mt-0.5">
                  Bulk onboard new learner admissions with automated user profile creation, registration
                  ID generation, and immediate degree program enrolment.
                </p>
              </div>
            </div>
            <BulkIntakeCard />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── MODAL 1: Set / Edit Department ────────────────────────── */}
      {showSetDept && (
        <AdminModal
          title={department ? "Edit Department Identity" : "Initialize Academic Department"}
          onClose={() => setShowSetDept(false)}
        >
          <form className="space-y-4" onSubmit={handleSetDept}>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department Full Name</Label>
              <Input
                type="text"
                placeholder="e.g. Faculty of Computer & Information Technology"
                value={deptForm.name}
                onChange={(e) =>
                  setDeptForm((f) => ({
                    ...f,
                    name: e.target.value,
                    code: f.code || suggestDeptCode(e.target.value),
                  }))
                }
                required
                className="text-xs h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department Code</Label>
              <Input
                type="text"
                placeholder="e.g. FCIT or ENG"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                required
                className="text-xs h-9 font-mono font-bold uppercase rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Short institutional code used on academic transcripts, class timetable badges, and official records.
              </p>
            </div>

            {error && <p className="text-xs text-destructive font-medium">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowSetDept(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? (department ? "Saving…" : "Initializing…") : department ? "Save Changes" : "Set Department"}
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ── MODAL 2: Add Program ──────────────────────────────────── */}
      {showCreateProgram && (
        <AdminModal title="Add New Degree Program" onClose={() => setShowCreateProgram(false)}>
          <form className="space-y-4" onSubmit={handleCreateProgram}>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Program Title</Label>
              <Input
                type="text"
                placeholder="e.g. Bachelor of Computer Applications"
                value={programForm.name}
                onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                required
                className="text-xs h-9 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Program Code</Label>
                <Input
                  type="text"
                  placeholder="e.g. BCA or BCT"
                  value={programForm.code}
                  onChange={(e) => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                  required
                  className="text-xs h-9 font-mono font-bold uppercase rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Duration (Years)</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={programForm.durationYears}
                  onChange={(e) => setProgramForm({ ...programForm, durationYears: e.target.value })}
                  required
                  className="text-xs h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Calculated summary pill */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
              <IconClock size={15} className="text-primary shrink-0" />
              <span>
                Standard academic structure:{" "}
                <strong className="text-foreground">
                  {Number(programForm.durationYears || 0) * 2} Semesters
                </strong>{" "}
                across {programForm.durationYears} academic years.
              </span>
            </div>

            {error && <p className="text-xs text-destructive font-medium">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateProgram(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create Program"}
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ── MODAL 3: Edit Program ─────────────────────────────────── */}
      {editingProgram && (
        <AdminModal
          title={`Edit Degree Program: ${editingProgram.code}`}
          onClose={() => setEditingProgram(null)}
        >
          <form className="space-y-4" onSubmit={handleUpdateProgram}>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Program Title</Label>
              <Input
                type="text"
                value={editingProgram.name}
                onChange={(e) => setEditingProgram({ ...editingProgram, name: e.target.value })}
                required
                className="text-xs h-9 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Program Code</Label>
                <Input
                  type="text"
                  value={editingProgram.code}
                  onChange={(e) => setEditingProgram({ ...editingProgram, code: e.target.value.toUpperCase() })}
                  required
                  className="text-xs h-9 font-mono font-bold uppercase rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Duration (Years)</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={editingProgram.durationYearsStr}
                  onChange={(e) => setEditingProgram({ ...editingProgram, durationYearsStr: e.target.value })}
                  required
                  className="text-xs h-9 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
              <IconClock size={15} className="text-primary shrink-0" />
              <span>
                Calculated:{" "}
                <strong className="text-foreground">
                  {Number(editingProgram.durationYearsStr || 0) * 2} Semesters
                </strong>{" "}
                total curriculum depth.
              </span>
            </div>

            {error && <p className="text-xs text-destructive font-medium">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setEditingProgram(null)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* ── MODAL 4: Delete Program Confirmation ──────────────────── */}
      {deletingProgram && (
        <AdminModal
          title={`Delete Program: ${deletingProgram.code}`}
          onClose={() => setDeletingProgram(null)}
        >
          <div className="space-y-3.5 text-xs text-muted-foreground">
            <p className="text-sm text-foreground">
              Are you sure you want to permanently delete{" "}
              <strong>
                {deletingProgram.name} ({deletingProgram.code})
              </strong>
              ?
            </p>
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <IconAlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                This action cannot be undone. If any students, enrolled classes, or assessment records
                exist for this degree program, the server will block deletion. If you want to retire
                the program safely without losing any historical data, use <strong>Archive</strong> instead.
              </p>
            </div>
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setDeletingProgram(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="button"
                onClick={handleDeleteProgram}
                disabled={saving}
              >
                {saving ? "Deleting…" : "Yes, Delete Program"}
              </Button>
            </div>
          </div>
        </AdminModal>
      )}
    </AdminShell>
  );
}
