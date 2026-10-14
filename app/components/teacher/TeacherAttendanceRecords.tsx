"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PaginationControls, type PaginationMeta } from "@/app/components/common/PaginationControls";
import {
  IconAlertTriangle,
  IconCalendarCheck,
  IconCheck,
  IconDownload,
  IconEye,
  IconFilter,
  IconFilterOff,
  IconListCheck,
  IconSearch,
  IconTrendingUp,
  IconUsers,
  IconX,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";

export type ProgramOption = {
  id: string;
  code: string;
  name: string;
};

export type SubjectOption = {
  id: string;
  code: string;
  name: string;
  semester: number;
  programId: string;
  programCode: string;
  programName: string;
};

export type StudentSummaryItem = {
  studentId: string;
  enrollmentNumber: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  programCode: string;
  programName: string;
  semester: number;
  firstName: string;
  lastName: string;
  accountStatus: string;
  present: number;
  total: number;
  percentage: number;
};

export type SessionRecordItem = {
  id: string;
  status: "PRESENT" | "ABSENT";
  studentId: string;
  note?: string | null;
  student: {
    id: string;
    enrollmentNumber: string;
    rollNumber: number | null;
    profileImageUrl: string | null;
    user: { firstName: string; lastName: string; status: string };
  };
};

export type SessionItem = {
  id: string;
  sessionDate: string;
  createdAt: string;
  class: {
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    semester: number;
    type: string;
    group: string | null;
    subject: { id: string; code: string; name: string };
    program: { id: string; code: string; name: string };
  };
  records: SessionRecordItem[];
};

export type AttendanceStats = {
  totalSessions: number;
  classAverageRate: number;
  atRiskCount: number;
  totalStudents: number;
};

export type StudentHistoryEntry = {
  sessionId: string;
  sessionDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type: string;
  group: string | null;
  subjectCode: string;
  subjectName: string;
  status: "PRESENT" | "ABSENT";
  note: string | null;
};

export type StudentHistoryModalData = {
  student: {
    id: string;
    enrollmentNumber: string;
    rollNumber: number | null;
    profileImageUrl: string | null;
    programCode: string;
    programName: string;
    semester: number;
    name: string;
    accountStatus: string;
  };
  history: StudentHistoryEntry[];
  stats: {
    totalSessions: number;
    presentSessions: number;
    absentSessions: number;
    percentage: number;
  };
};

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeSlot(startISO: string, endISO: string): string {
  const getHHMM = (iso: string) => {
    const match = iso.match(/T(\d{2}):(\d{2})/);
    return match ? `${match[1]}:${match[2]}` : "";
  };
  const s = getHHMM(startISO);
  const e = getHHMM(endISO);
  return s && e ? `${s} - ${e}` : "Scheduled";
}

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "ST";
}

export function TeacherAttendanceRecords() {
  // Cascading Academic Filter States
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [semesters, setSemesters] = useState<number[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  const [selectedProgramId, setSelectedProgramId] = useState<string>("ALL");
  const [selectedSemester, setSelectedSemester] = useState<string>("ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");

  // Date Range Filters
  const [datePreset, setDatePreset] = useState<"all" | "30days" | "month" | "custom">("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Student Search, Filter, & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [rosterFilter, setRosterFilter] = useState<"all" | "atRisk" | "good">("all");
  const [rosterPage, setRosterPage] = useState<number>(1);
  const [rosterPageSize, setRosterPageSize] = useState<number>(25);

  // Active view: "roster" | "sessions"
  const [activeView, setActiveView] = useState<"roster" | "sessions">("roster");

  // Data states
  const [summary, setSummary] = useState<StudentSummaryItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalSessions: 0,
    classAverageRate: 0,
    atRiskCount: 0,
    totalStudents: 0,
  });
  const [sessionPagination, setSessionPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Student history modal
  const [studentModalData, setStudentModalData] = useState<StudentHistoryModalData | null>(null);
  const [loadingStudentModal, setLoadingStudentModal] = useState(false);

  // Session roll sheet modal
  const [selectedSessionForRoll, setSelectedSessionForRoll] = useState<SessionItem | null>(null);
  const [sessionRollSearch, setSessionRollSearch] = useState("");
  const [sessionRollFilter, setSessionRollFilter] = useState<"all" | "present" | "absent">("all");

  // Initial load
  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      try {
        const res = await fetch("/api/teacher/attendance-history");
        if (!res.ok) {
          toast.error("Failed to load attendance records");
          return;
        }
        const data = await res.json();
        setPrograms(data.programs ?? []);
        setSemesters(data.semesters ?? []);
        setSubjects(data.subjects ?? []);
        setSummary(data.summary ?? []);
        setSessions(data.sessions ?? []);
        setStats(
          data.stats ?? {
            totalSessions: 0,
            classAverageRate: 0,
            atRiskCount: 0,
            totalStudents: 0,
          },
        );
        if (data.pagination) {
          setSessionPagination({
            page: data.pagination.page,
            pageSize: data.pagination.pageSize,
            total: data.pagination.totalItems,
            totalPages: data.pagination.totalPages,
            hasMore: data.pagination.hasNext,
          });
        }
      } catch {
        toast.error("Network error while loading attendance history");
      } finally {
        setLoading(false);
      }
    }

    void loadInitial();
  }, []);

  // Fetch data matching current filters
  async function fetchFilteredData(
    progId = selectedProgramId,
    sem = selectedSemester,
    subId = selectedSubjectId,
    sessionPage = 1,
    fDate = fromDate,
    tDate = toDate,
  ) {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (progId !== "ALL") params.set("programId", progId);
      if (sem !== "ALL") params.set("semester", sem);
      if (subId !== "ALL") params.set("subjectId", subId);
      params.set("page", String(sessionPage));
      params.set("pageSize", "20");
      if (fDate) params.set("from", fDate);
      if (tDate) params.set("to", tDate);

      const res = await fetch(`/api/teacher/attendance-history?${params.toString()}`);
      if (!res.ok) {
        toast.error("Failed to fetch records for selected filter");
        return;
      }
      const data = await res.json();
      setSummary(data.summary ?? []);
      setSessions(data.sessions ?? []);
      setStats(
        data.stats ?? {
          totalSessions: 0,
          classAverageRate: 0,
          atRiskCount: 0,
          totalStudents: 0,
        },
      );
      if (data.pagination) {
        setSessionPagination({
          page: data.pagination.page,
          pageSize: data.pagination.pageSize,
          total: data.pagination.totalItems,
          totalPages: data.pagination.totalPages,
          hasMore: data.pagination.hasNext,
        });
      }
      setRosterPage(1); // Reset student pagination on filter change
    } catch {
      toast.error("Unable to load attendance records");
    } finally {
      setRefreshing(false);
    }
  }

  // Derived available semesters based on selected program
  const availableSemesters = useMemo(() => {
    if (selectedProgramId === "ALL") return semesters;
    const sems = new Set<number>();
    for (const s of subjects) {
      if (s.programId === selectedProgramId) sems.add(s.semester);
    }
    return Array.from(sems).sort((a, b) => a - b);
  }, [selectedProgramId, semesters, subjects]);

  // Derived available subjects based on selected program and semester
  const availableSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (selectedProgramId !== "ALL" && s.programId !== selectedProgramId) return false;
      if (selectedSemester !== "ALL" && String(s.semester) !== selectedSemester) return false;
      return true;
    });
  }, [subjects, selectedProgramId, selectedSemester]);

  // Handlers for cascading filters
  function handleProgramChange(progId: string) {
    setSelectedProgramId(progId);
    // If selected semester is not valid in new program, reset to ALL
    let nextSem = selectedSemester;
    if (progId !== "ALL") {
      const validSems = subjects
        .filter((s) => s.programId === progId)
        .map((s) => String(s.semester));
      if (!validSems.includes(selectedSemester)) {
        nextSem = "ALL";
        setSelectedSemester("ALL");
      }
    }
    // Reset subject to ALL
    setSelectedSubjectId("ALL");
    void fetchFilteredData(progId, nextSem, "ALL", 1, fromDate, toDate);
  }

  function handleSemesterChange(sem: string) {
    setSelectedSemester(sem);
    // Reset subject to ALL
    setSelectedSubjectId("ALL");
    void fetchFilteredData(selectedProgramId, sem, "ALL", 1, fromDate, toDate);
  }

  function handleSubjectChange(subId: string) {
    setSelectedSubjectId(subId);
    void fetchFilteredData(selectedProgramId, selectedSemester, subId, 1, fromDate, toDate);
  }

  function handleResetFilters() {
    setSelectedProgramId("ALL");
    setSelectedSemester("ALL");
    setSelectedSubjectId("ALL");
    setDatePreset("all");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
    setRosterFilter("all");
    setRosterPage(1);
    void fetchFilteredData("ALL", "ALL", "ALL", 1, "", "");
  }

  function handlePresetChange(preset: "all" | "30days" | "month" | "custom") {
    setDatePreset(preset);
    let f = "";
    let t = "";
    const now = new Date();
    const todayISO = now.toISOString().split("T")[0];

    if (preset === "30days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      f = d.toISOString().split("T")[0];
      t = todayISO;
      setFromDate(f);
      setToDate(t);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      f = firstDay.toISOString().split("T")[0];
      t = todayISO;
      setFromDate(f);
      setToDate(t);
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
      f = "";
      t = "";
    }

    if (preset !== "custom") {
      void fetchFilteredData(selectedProgramId, selectedSemester, selectedSubjectId, 1, f, t);
    }
  }

  function applyCustomDateFilter() {
    if (!fromDate && !toDate) {
      toast.error("Please pick at least a start or end date");
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("Start date must be before or equal to end date");
      return;
    }
    void fetchFilteredData(selectedProgramId, selectedSemester, selectedSubjectId, 1, fromDate, toDate);
  }

  // Filtered roster students by text search & status
  const filteredRoster = useMemo(() => {
    let list = summary;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          s.enrollmentNumber.toLowerCase().includes(q) ||
          (s.rollNumber != null && String(s.rollNumber).includes(q)) ||
          s.programCode.toLowerCase().includes(q),
      );
    }
    if (rosterFilter === "atRisk") {
      list = list.filter((s) => s.total > 0 && s.percentage < 75);
    } else if (rosterFilter === "good") {
      list = list.filter((s) => s.total > 0 && s.percentage >= 75);
    }
    return list;
  }, [summary, searchQuery, rosterFilter]);

  // Paginated roster slice
  const paginatedRoster = useMemo(() => {
    const start = (rosterPage - 1) * rosterPageSize;
    return filteredRoster.slice(start, start + rosterPageSize);
  }, [filteredRoster, rosterPage, rosterPageSize]);

  const totalRosterPages = Math.ceil(filteredRoster.length / rosterPageSize) || 1;

  // Open detailed student history
  async function openStudentHistory(studentId: string) {
    setLoadingStudentModal(true);
    setStudentModalData(null);
    try {
      const params = new URLSearchParams();
      if (selectedSubjectId !== "ALL") params.set("subjectId", selectedSubjectId);
      if (selectedProgramId !== "ALL") params.set("programId", selectedProgramId);
      if (selectedSemester !== "ALL") params.set("semester", selectedSemester);
      params.set("studentId", studentId);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/teacher/attendance-history?${params.toString()}`);
      if (!res.ok) {
        toast.error("Failed to load student attendance history");
        return;
      }
      const data = await res.json();
      setStudentModalData(data);
    } catch {
      toast.error("Unable to load student attendance history");
    } finally {
      setLoadingStudentModal(false);
    }
  }

  // Export CSV
  function handleExportCSV() {
    if (summary.length === 0) {
      toast.error("No student records available to export");
      return;
    }

    const progLabel = selectedProgramId !== "ALL" ? selectedProgramId : "AllPrograms";
    const semLabel = selectedSemester !== "ALL" ? `Sem${selectedSemester}` : "AllSem";

    const headers = [
      "Roll No",
      "First Name",
      "Last Name",
      "Enrollment No",
      "Program",
      "Semester",
      "Account Status",
      "Attended Sessions",
      "Total Sessions",
      "Absent Sessions",
      "Attendance Percentage",
      "Exam Eligibility (75% Threshold)",
    ];

    const rows = summary.map((s) => [
      s.rollNumber ?? "N/A",
      `"${s.firstName.replace(/"/g, '""')}"`,
      `"${s.lastName.replace(/"/g, '""')}"`,
      `"${s.enrollmentNumber}"`,
      s.programCode || "—",
      s.semester || "—",
      s.accountStatus,
      s.present,
      s.total,
      s.total - s.present,
      `${s.percentage}%`,
      s.percentage >= 75 ? "ELIGIBLE" : "AT_RISK",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `Attendance_Report_${progLabel}_${semLabel}_${dateStamp}.csv`;
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Attendance report downloaded successfully");
  }

  const hasActiveFilters =
    selectedProgramId !== "ALL" ||
    selectedSemester !== "ALL" ||
    selectedSubjectId !== "ALL" ||
    datePreset !== "all" ||
    searchQuery !== "" ||
    rosterFilter !== "all";

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Filter bar skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-border/60 bg-card">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Metric cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>

        {/* Records table skeleton */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="p-4 border-b border-border/50 flex justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="divide-y divide-border/40 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (programs.length === 0 && subjects.length === 0) {
    return (
      <div className="flex min-h-85 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-12 text-center shadow-xs">
        <IconCalendarCheck className="size-10 text-muted-foreground/60" aria-hidden="true" />
        <h3 className="text-base font-semibold">No Teaching Assignments Found</h3>
        <p className="max-w-md text-xs text-muted-foreground">
          You are currently not assigned to any programs, semesters, or classes.
          Please contact your college administration to configure your academic assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Academic Filters Card ─────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconFilter size={15} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Academic Filters</h3>
              <p className="text-xs text-muted-foreground">
                Narrow student records and session logs by program, semester, and subject
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <IconFilterOff size={14} aria-hidden="true" />
                Reset Filters
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() =>
                fetchFilteredData(
                  selectedProgramId,
                  selectedSemester,
                  selectedSubjectId,
                  sessionPagination.page,
                  datePreset === "all" ? "" : fromDate,
                  datePreset === "all" ? "" : toDate,
                )
              }
              className="h-8 gap-1.5 text-xs"
              title="Refresh data"
            >
              <IconRefresh className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>Refresh</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={summary.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <IconDownload className="size-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Filter 1: Program */}
          <div className="space-y-1.5">
            <Label htmlFor="filter-prog" className="text-xs font-semibold text-muted-foreground">
              Program / Faculty
            </Label>
            <Select value={selectedProgramId} onValueChange={handleProgramChange}>
              <SelectTrigger id="filter-prog" className="h-9 w-full text-xs">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Assigned Programs ({programs.length})</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter 2: Semester */}
          <div className="space-y-1.5">
            <Label htmlFor="filter-sem" className="text-xs font-semibold text-muted-foreground">
              Semester
            </Label>
            <Select value={selectedSemester} onValueChange={handleSemesterChange}>
              <SelectTrigger id="filter-sem" className="h-9 w-full text-xs">
                <SelectValue placeholder="All Semesters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Semesters</SelectItem>
                {availableSemesters.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    Semester {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter 3: Subject */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="filter-sub" className="text-xs font-semibold text-muted-foreground">
              Teaching Subject
            </Label>
            <Select value={selectedSubjectId} onValueChange={handleSubjectChange}>
              <SelectTrigger id="filter-sub" className="h-9 w-full text-xs">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Teaching Subjects ({availableSubjects.length})</SelectItem>
                {availableSubjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    [{sub.programCode} · Sem {sub.semester}] {sub.name} ({sub.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter 4: Time Range Preset */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="filter-date" className="text-xs font-semibold text-muted-foreground">
              Date Period
            </Label>
            <Select
              value={datePreset}
              onValueChange={(v) => handlePresetChange(v as "all" | "30days" | "month" | "custom")}
            >
              <SelectTrigger id="filter-date" className="h-9 w-full text-xs">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time (Full Semester)</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date Range…</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Date Pickers (visible only when "custom" is selected) */}
        {datePreset === "custom" && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 rounded-lg border bg-muted/30 p-2.5">
            <span className="text-xs font-medium text-muted-foreground">From:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-36 text-xs"
            />
            <span className="text-xs font-medium text-muted-foreground">To:</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-36 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={applyCustomDateFilter}
              className="h-8 text-xs font-medium"
            >
              Apply Dates
            </Button>
          </div>
        )}
      </section>

      {/* ── 2. Metric Overview KPI Cards ──────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Sessions */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sessions Held
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconCalendarCheck size={16} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {stats.totalSessions}
            </strong>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recorded roll-call logs
            </p>
          </div>
        </article>

        {/* Class Average Rate */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Class Attendance
            </span>
            <span
              className={`flex size-7 items-center justify-center rounded-lg ${
                stats.classAverageRate >= 75
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <IconTrendingUp size={16} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3">
            <strong
              className={`text-2xl font-bold tracking-tight sm:text-3xl ${
                stats.classAverageRate >= 75
                  ? "text-emerald-600 dark:text-emerald-400"
                  : stats.classAverageRate >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"
              }`}
            >
              {stats.classAverageRate}%
            </strong>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Average across {stats.totalStudents} students
            </p>
          </div>
        </article>

        {/* Total Enrolled Students */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Enrolled Students
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <IconUsers size={16} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {stats.totalStudents}
            </strong>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Active cohort roster size
            </p>
          </div>
        </article>

        {/* At Risk Students (<75%) */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shortage (&lt;75%)
            </span>
            <span
              className={`flex size-7 items-center justify-center rounded-lg ${
                stats.atRiskCount > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <IconAlertTriangle size={16} aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <strong
                className={`text-2xl font-bold tracking-tight sm:text-3xl ${
                  stats.atRiskCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {stats.atRiskCount}
              </strong>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Students below exam threshold
              </p>
            </div>
            {stats.atRiskCount > 0 && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]">
                Exam Warning
              </Badge>
            )}
          </div>
        </article>
      </section>

      {/* ── 3. Main Views Section (Roster vs Sessions) ────────────────────── */}
      <section className="rounded-xl border bg-card shadow-xs">
        {/* View Switcher Header */}
        <div className="flex flex-col gap-4 border-b p-5">
          {/* Segmented View Switcher */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setActiveView("roster")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeView === "roster"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconUsers size={14} aria-hidden="true" />
              <span>Student Roster</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-bold">
                {summary.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("sessions")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeView === "sessions"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconListCheck size={14} aria-hidden="true" />
              <span>Session Logs</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-bold">
                {stats.totalSessions}
              </span>
            </button>
          </div>

          {/* Controls specific to Student Roster view */}
          {activeView === "roster" && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              {/* Quick search */}
              <div className="relative w-full lg:max-w-sm lg:flex-1">
                <IconSearch className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Search name, roll, enrollment..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setRosterPage(1);
                  }}
                  className="h-8.5 pl-8 text-xs"
                />
              </div>

              {/* Status filter pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={rosterFilter === "all" ? "default" : "outline"}
                  onClick={() => {
                    setRosterFilter("all");
                    setRosterPage(1);
                  }}
                  className="h-8 text-xs px-2.5"
                >
                  All ({summary.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={rosterFilter === "atRisk" ? "default" : "outline"}
                  onClick={() => {
                    setRosterFilter("atRisk");
                    setRosterPage(1);
                  }}
                  className={`h-8 text-xs px-2.5 ${
                    rosterFilter === "atRisk"
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "text-amber-700 dark:text-amber-300 border-amber-500/30"
                  }`}
                >
                  <IconAlertTriangle className="size-3 mr-1" aria-hidden="true" />
                  &lt;75% ({stats.atRiskCount})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={rosterFilter === "good" ? "default" : "outline"}
                  onClick={() => {
                    setRosterFilter("good");
                    setRosterPage(1);
                  }}
                  className={`h-8 text-xs px-2.5 ${
                    rosterFilter === "good"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  <IconCheck className="size-3 mr-1" aria-hidden="true" />
                  &ge;75% ({summary.length - stats.atRiskCount})
                </Button>
              </div>

              {/* Page size dropdown for 100s of students */}
              <div className="flex items-center gap-1.5 lg:ml-auto lg:border-l lg:pl-4">
                <span className="text-[11px] text-muted-foreground">Rows:</span>
                <Select
                  value={String(rosterPageSize)}
                  onValueChange={(val) => {
                    setRosterPageSize(Number(val));
                    setRosterPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-18 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* ── View 1: Student Roster Table ─────────────────────────────────── */}
        {activeView === "roster" && (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-16 text-center font-bold">Roll</TableHead>
                    <TableHead className="min-w-56 font-bold">Name</TableHead>
                    <TableHead className="font-bold">Class</TableHead>
                    <TableHead className="text-center font-bold">Attended</TableHead>
                    <TableHead className="min-w-44 font-bold">Attendance %</TableHead>
                    <TableHead className="text-center font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold pr-5">Timeline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoster.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        No students match the current filters or search query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRoster.map((student) => {
                      const isAtRisk = student.total > 0 && student.percentage < 75;
                      const isGood = student.percentage >= 75;
                      return (
                        <TableRow key={student.studentId} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-center font-bold text-foreground">
                            {student.rollNumber ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8.5 rounded-lg after:rounded-lg">
                                {student.profileImageUrl ? (
                                  <AvatarImage
                                    src={student.profileImageUrl}
                                    alt={`${student.firstName} ${student.lastName}`}
                                    className="rounded-lg object-cover"
                                  />
                                ) : null}
                                <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                  {getInitials(student.firstName, student.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-semibold leading-tight text-foreground">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="font-mono text-[11px] text-muted-foreground">
                                  {student.enrollmentNumber}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] font-medium">
                              {student.programCode || "—"} · Sem {student.semester || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400">
                            {student.present} / {student.total}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold tabular-nums">
                                  {student.percentage}%
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-semibold leading-tight ${
                                    isGood
                                      ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                      : isAtRisk
                                        ? "border-amber-500/40 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                        : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isGood
                                    ? "Eligible (≥75%)"
                                    : isAtRisk
                                      ? "At Risk (<75%)"
                                      : "No Sessions"}
                                </Badge>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isGood
                                      ? "bg-emerald-500"
                                      : student.percentage >= 60
                                        ? "bg-amber-500"
                                        : "bg-destructive"
                                  }`}
                                  style={{
                                    width: `${Math.min(100, student.percentage)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                student.accountStatus === "ACTIVE"
                                  ? "outline"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {student.accountStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openStudentHistory(student.studentId)}
                              className="h-7.5 gap-1.5 text-xs font-medium"
                              title="View individual attendance history"
                            >
                              <IconEye className="size-3.5" aria-hidden="true" />
                              View Log
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Client-Side Pagination Controls for 100s of students */}
            {filteredRoster.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
                <p className="m-0 text-xs text-muted-foreground">
                  Showing{" "}
                  <strong className="font-semibold text-foreground">
                    {(rosterPage - 1) * rosterPageSize + 1}–
                    {Math.min(rosterPage * rosterPageSize, filteredRoster.length)}
                  </strong>{" "}
                  of {filteredRoster.length} students
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Page {rosterPage} of {totalRosterPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rosterPage <= 1}
                    onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                    className="h-8 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rosterPage >= totalRosterPages}
                    onClick={() => setRosterPage((p) => Math.min(totalRosterPages, p + 1))}
                    className="h-8 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── View 2: Conducted Sessions Table ─────────────────────────────── */}
        {activeView === "sessions" && (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold">Session Date</TableHead>
                    <TableHead className="font-bold">Subject &amp; Cohort</TableHead>
                    <TableHead className="font-bold">Day &amp; Time Slot</TableHead>
                    <TableHead className="font-bold">Class Type</TableHead>
                    <TableHead className="text-center font-bold">Present</TableHead>
                    <TableHead className="text-center font-bold">Absent</TableHead>
                    <TableHead className="text-center font-bold">Rate</TableHead>
                    <TableHead className="text-right font-bold pr-5">Roll Sheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                        No sessions recorded for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => {
                      const presentCount = session.records.filter(
                        (r) => r.status === "PRESENT",
                      ).length;
                      const totalCount = session.records.length;
                      const rate =
                        totalCount > 0
                          ? Number(((presentCount / totalCount) * 100).toFixed(1))
                          : 0;
                      return (
                        <TableRow key={session.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-semibold text-foreground">
                            {formatDisplayDate(session.sessionDate)}
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-semibold text-foreground">
                              {session.class.subject.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {session.class.program.code} · Sem {session.class.semester} ({session.class.subject.code})
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {session.class.dayOfWeek} ·{" "}
                            {formatTimeSlot(
                              session.class.startTime,
                              session.class.endTime,
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {session.class.type}
                              {session.class.group ? ` (${session.class.group})` : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400">
                            {presentCount}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-destructive">
                            {totalCount - presentCount}
                          </TableCell>
                          <TableCell className="text-center font-bold tabular-nums">
                            {rate}%
                          </TableCell>
                          <TableCell className="text-right pr-5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSessionForRoll(session);
                                setSessionRollSearch("");
                                setSessionRollFilter("all");
                              }}
                              className="h-7.5 gap-1.5 text-xs font-medium"
                            >
                              <IconListCheck className="size-3.5" aria-hidden="true" />
                              View Roll
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls for Sessions */}
            {sessionPagination.total > 0 && (
              <PaginationControls
                pagination={sessionPagination}
                label="sessions"
                busy={refreshing}
                onPageChange={(nextPage) =>
                  fetchFilteredData(
                    selectedProgramId,
                    selectedSemester,
                    selectedSubjectId,
                    nextPage,
                    datePreset === "all" ? "" : fromDate,
                    datePreset === "all" ? "" : toDate,
                  )
                }
              />
            )}
          </div>
        )}
      </section>

      {/* ── Modal 1: Individual Student History ────────────────────────────── */}
      <Dialog
        open={Boolean(studentModalData || loadingStudentModal)}
        onOpenChange={(open) => {
          if (!open) setStudentModalData(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Student Attendance Profile</DialogTitle>
            <DialogDescription>
              Chronological attendance timeline for the selected academic filters
            </DialogDescription>
          </DialogHeader>

          {loadingStudentModal ? (
            <div className="flex min-h-55 items-center justify-center">
              <IconLoader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : studentModalData ? (
            <div className="space-y-4">
              {/* Student Summary Card */}
              <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {studentModalData.student.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Enrollment: {studentModalData.student.enrollmentNumber} · Roll:{" "}
                    {studentModalData.student.rollNumber ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cohort: {studentModalData.student.programCode} · Semester {studentModalData.student.semester}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Attendance</p>
                    <p
                      className={`text-xl font-bold ${
                        studentModalData.stats.percentage >= 75
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {studentModalData.stats.percentage}%
                    </p>
                  </div>
                  <Badge
                    variant={
                      studentModalData.stats.percentage >= 75
                        ? "default"
                        : "destructive"
                    }
                    className={
                      studentModalData.stats.percentage >= 75
                        ? "bg-emerald-600 text-white"
                        : ""
                    }
                  >
                    {studentModalData.stats.percentage >= 75
                      ? "Eligible (≥75%)"
                      : "Shortage (<75%)"}
                  </Badge>
                </div>
              </div>

              {/* Warning if below threshold */}
              {studentModalData.stats.percentage < 75 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <IconAlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <strong className="font-semibold">Institutional Attendance Warning</strong>
                    <p className="mt-0.5">
                      This student has attended {studentModalData.stats.presentSessions} of{" "}
                      {studentModalData.stats.totalSessions} sessions ({studentModalData.stats.percentage}%).
                      University policy requires at least 75% attendance to sit for final semester examinations.
                    </p>
                  </div>
                </div>
              )}

              {/* Session list table */}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Day &amp; Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Attendance Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentModalData.history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                          No sessions recorded in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      studentModalData.history.map((h) => (
                        <TableRow key={h.sessionId}>
                          <TableCell className="font-medium text-foreground">
                            {formatDisplayDate(h.sessionDate)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-semibold">{h.subjectName}</span>{" "}
                            <span className="text-muted-foreground">({h.subjectCode})</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {h.dayOfWeek} · {formatTimeSlot(h.startTime, h.endTime)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" className="text-[10px]">
                              {h.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {h.status === "PRESENT" ? (
                              <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 border-emerald-500/30 dark:text-emerald-400">
                                <IconCheck className="size-3 mr-1" />
                                Present
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <IconX className="size-3 mr-1" />
                                Absent
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Modal 2: Session Roll Sheet ────────────────────────────────────── */}
      <Dialog
        open={Boolean(selectedSessionForRoll)}
        onOpenChange={(open) => {
          if (!open) setSelectedSessionForRoll(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              Roll Sheet: {selectedSessionForRoll ? formatDisplayDate(selectedSessionForRoll.sessionDate) : ""}
            </DialogTitle>
            <DialogDescription>
              {selectedSessionForRoll?.class.subject.name} ({selectedSessionForRoll?.class.subject.code}) ·{" "}
              {selectedSessionForRoll?.class.program.code} · Sem {selectedSessionForRoll?.class.semester} ·{" "}
              {selectedSessionForRoll?.class.dayOfWeek} ·{" "}
              {selectedSessionForRoll ? formatTimeSlot(selectedSessionForRoll.class.startTime, selectedSessionForRoll.class.endTime) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedSessionForRoll && (() => {
            const allRecords = selectedSessionForRoll.records;
            const presentRecords = allRecords.filter((r) => r.status === "PRESENT");
            const absentRecords = allRecords.filter((r) => r.status === "ABSENT");

            let displayed = allRecords;
            const q = sessionRollSearch.toLowerCase().trim();
            if (q) {
              displayed = displayed.filter(
                (r) =>
                  r.student.user.firstName.toLowerCase().includes(q) ||
                  r.student.user.lastName.toLowerCase().includes(q) ||
                  r.student.enrollmentNumber.toLowerCase().includes(q) ||
                  (r.student.rollNumber != null && String(r.student.rollNumber).includes(q)),
              );
            }
            if (sessionRollFilter === "present") {
              displayed = displayed.filter((r) => r.status === "PRESENT");
            } else if (sessionRollFilter === "absent") {
              displayed = displayed.filter((r) => r.status === "ABSENT");
            }

            return (
              <div className="space-y-4">
                {/* Session Stats bar */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-center">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Enrolled</p>
                    <p className="text-base font-bold text-foreground">{allRecords.length}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Marked Present</p>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {presentRecords.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Marked Absent</p>
                    <p className="text-base font-bold text-destructive">{absentRecords.length}</p>
                  </div>
                </div>

                {/* Filter and search bar */}
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <IconSearch className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                    <Input
                      type="search"
                      placeholder="Search student or roll..."
                      value={sessionRollSearch}
                      onChange={(e) => setSessionRollSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={sessionRollFilter === "all" ? "default" : "outline"}
                      onClick={() => setSessionRollFilter("all")}
                      className="h-7 text-xs"
                    >
                      All ({allRecords.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={sessionRollFilter === "present" ? "default" : "outline"}
                      onClick={() => setSessionRollFilter("present")}
                      className="h-7 text-xs text-emerald-600 dark:text-emerald-400"
                    >
                      Present ({presentRecords.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={sessionRollFilter === "absent" ? "default" : "outline"}
                      onClick={() => setSessionRollFilter("absent")}
                      className="h-7 text-xs text-destructive"
                    >
                      Absent ({absentRecords.length})
                    </Button>
                  </div>
                </div>

                {/* Roll call table */}
                <div className="overflow-x-auto rounded-lg border max-h-87.5">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-16 text-center font-bold">Roll</TableHead>
                        <TableHead className="font-bold">Student Name</TableHead>
                        <TableHead className="font-bold">Enrollment No</TableHead>
                        <TableHead className="text-right font-bold pr-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayed.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                            No students match the search/filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayed.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="text-center font-bold">
                              {rec.student.rollNumber ?? "—"}
                            </TableCell>
                            <TableCell className="font-semibold text-xs">
                              {rec.student.user.firstName} {rec.student.user.lastName}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {rec.student.enrollmentNumber}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              {rec.status === "PRESENT" ? (
                                <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 border-emerald-500/30 dark:text-emerald-400">
                                  <IconCheck className="size-3 mr-1" />
                                  Present
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <IconX className="size-3 mr-1" />
                                  Absent
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
