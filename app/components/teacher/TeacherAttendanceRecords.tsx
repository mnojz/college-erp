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
  IconCalendar,
  IconCalendarCheck,
  IconCheck,
  IconClock,
  IconDownload,
  IconFilter,
  IconFilterOff,
  IconListCheck,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconTrendingUp,
  IconUsers,
  IconX,
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
      setRosterPage(1);
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
    setSelectedSubjectId("ALL");
    void fetchFilteredData(progId, nextSem, "ALL", 1, fromDate, toDate);
  }

  function handleSemesterChange(sem: string) {
    setSelectedSemester(sem);
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

  // Grouped history for student modal (grouped by calendar date)
  const studentHistory = studentModalData?.history;
  const groupedStudentHistory = useMemo(() => {
    if (!studentHistory || studentHistory.length === 0) return [];

    const map = new Map<
      string,
      {
        dateKey: string;
        displayDate: string;
        weekday: string;
        items: StudentHistoryEntry[];
        presentCount: number;
        absentCount: number;
      }
    >();

    for (const h of studentHistory) {
      const dateKey = h.sessionDate ? h.sessionDate.split("T")[0] : "unknown";
      if (!map.has(dateKey)) {
        const d = new Date(h.sessionDate);
        const isValid = !isNaN(d.getTime());
        const displayDate = isValid
          ? d.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : dateKey;
        const weekday = h.dayOfWeek || (isValid ? d.toLocaleDateString("en-GB", { weekday: "long" }) : "");

        map.set(dateKey, {
          dateKey,
          displayDate,
          weekday,
          items: [],
          presentCount: 0,
          absentCount: 0,
        });
      }

      const group = map.get(dateKey)!;
      group.items.push(h);
      if (h.status === "PRESENT") {
        group.presentCount += 1;
      } else {
        group.absentCount += 1;
      }
    }

    // Sort descending by date (newest dates first)
    const sorted = Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    // Sort classes within each date by start time
    for (const g of sorted) {
      g.items.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    }

    return sorted;
  }, [studentHistory]);

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-border/60 bg-card">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>

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
      <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-card p-12 text-center shadow-xs">
        <div className="size-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-1">
          <IconCalendarCheck className="size-5" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-bold text-foreground">No Teaching Assignments Found</h3>
        <p className="max-w-md text-xs text-muted-foreground">
          You are currently not assigned to any programs, semesters, or classes.
          Please contact administration to configure your academic assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Unified Filter Control Surface ── */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconFilter size={15} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Academic Scope &amp; Analytics</h3>
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
                <IconFilterOff size={13} aria-hidden="true" />
                Reset
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
              className="h-8 gap-1.5 text-xs font-semibold"
              title="Refresh attendance records"
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
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <IconDownload className="size-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* 4-Column Dropdown Bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Program Filter */}
          <div className="space-y-1">
            <Label htmlFor="filter-prog" className="text-xs font-semibold text-muted-foreground">
              Program
            </Label>
            <Select value={selectedProgramId} onValueChange={handleProgramChange}>
              <SelectTrigger id="filter-prog" className="h-9 w-full text-xs">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Programs ({programs.length})</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Semester Filter */}
          <div className="space-y-1">
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

          {/* Subject Filter */}
          <div className="space-y-1">
            <Label htmlFor="filter-sub" className="text-xs font-semibold text-muted-foreground">
              Subject
            </Label>
            <Select value={selectedSubjectId} onValueChange={handleSubjectChange}>
              <SelectTrigger id="filter-sub" className="h-9 w-full text-xs">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Subjects ({availableSubjects.length})</SelectItem>
                {availableSubjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    [{sub.programCode} · Sem {sub.semester}] {sub.name} ({sub.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe Filter */}
          <div className="space-y-1">
            <Label htmlFor="filter-date" className="text-xs font-semibold text-muted-foreground">
              Timeframe
            </Label>
            <Select
              value={datePreset}
              onValueChange={(v) => handlePresetChange(v as "all" | "30days" | "month" | "custom")}
            >
              <SelectTrigger id="filter-date" className="h-9 w-full text-xs">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Full Semester (All Time)</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date Range…</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom Date Range Inline Row */}
        {datePreset === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-2.5">
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
              className="h-8 text-xs font-semibold"
            >
              Apply
            </Button>
          </div>
        )}
      </section>

      {/* ── 2. Metric Overview KPI Cards ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Sessions Held */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Sessions Held</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconCalendarCheck size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
            {stats.totalSessions}
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">Recorded roll calls</span>
        </article>

        {/* Cohort Attendance Rate */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Class Turnout</span>
            <div
              className={`flex size-7 items-center justify-center rounded-lg ${
                stats.classAverageRate >= 75
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <IconTrendingUp size={16} aria-hidden="true" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-extrabold sm:text-3xl ${
              stats.classAverageRate >= 75
                ? "text-emerald-600 dark:text-emerald-400"
                : stats.classAverageRate >= 60
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-destructive"
            }`}
          >
            {stats.classAverageRate}%
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">Average attendance rate</span>
        </article>

        {/* Enrolled Students */}
        <article className="flex min-w-0 flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Cohort Roster</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <IconUsers size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
            {stats.totalStudents}
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">Enrolled students</span>
        </article>

        {/* Attendance Shortage (<75%) - Interactive to trigger filter */}
        <article
          onClick={() => {
            setActiveView("roster");
            setRosterFilter("atRisk");
            setRosterPage(1);
          }}
          className={`flex min-w-0 flex-col justify-between rounded-xl border p-4 shadow-xs cursor-pointer transition-all ${
            stats.atRiskCount > 0
              ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60 hover:bg-amber-500/10"
              : "border-border/70 bg-card hover:border-border"
          }`}
          title="Click to view all students below 75% threshold"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shortage (&lt;75%)
            </span>
            <div
              className={`flex size-7 items-center justify-center rounded-lg ${
                stats.atRiskCount > 0
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <IconAlertTriangle size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold sm:text-3xl text-foreground">
            {stats.atRiskCount}
          </div>
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-0.5 flex items-center justify-between">
            <span>Below exam threshold</span>
            {stats.atRiskCount > 0 && <span className="underline text-[10px]">Filter &rarr;</span>}
          </span>
        </article>
      </section>

      {/* ── 3. Main Data Workspace (Roster vs Sessions) ── */}
      <section className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
        {/* View Switcher Bar */}
        <div className="border-b border-border/60 bg-muted/15 p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* View Pill Tabs */}
            <div className="inline-flex rounded-xl border border-border/60 bg-muted/40 p-1 self-start">
              <button
                type="button"
                onClick={() => setActiveView("roster")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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

            {/* Controls specific to Student Roster */}
            {activeView === "roster" && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative w-full sm:w-56">
                  <IconSearch className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    placeholder="Search student, roll, or ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setRosterPage(1);
                    }}
                    className="h-8.5 pl-8 text-xs"
                  />
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border/60 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => {
                      setRosterFilter("all");
                      setRosterPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      rosterFilter === "all"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({summary.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRosterFilter("atRisk");
                      setRosterPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      rosterFilter === "atRisk"
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "text-amber-700 dark:text-amber-300 hover:text-amber-800"
                    }`}
                  >
                    &lt;75% ({stats.atRiskCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRosterFilter("good");
                      setRosterPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      rosterFilter === "good"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-emerald-700 dark:text-emerald-300 hover:text-emerald-800"
                    }`}
                  >
                    &ge;75% ({summary.length - stats.atRiskCount})
                  </button>
                </div>

                {/* Rows dropdown */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[11px] text-muted-foreground">Rows:</span>
                  <Select
                    value={String(rosterPageSize)}
                    onValueChange={(val) => {
                      setRosterPageSize(Number(val));
                      setRosterPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-16 text-xs">
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
        </div>

        {/* ── View 1: Student Roster Table ── */}
        {activeView === "roster" && (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-b border-border/70">
                    <TableHead className="w-16 text-center font-bold text-xs uppercase tracking-wider">Roll</TableHead>
                    <TableHead className="min-w-56 font-bold text-xs uppercase tracking-wider">Student Profile</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Cohort</TableHead>
                    <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Attended</TableHead>
                    <TableHead className="min-w-44 font-bold text-xs uppercase tracking-wider">Attendance %</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase tracking-wider pr-5">Logs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoster.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                        No students match the current filters or search query.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRoster.map((student) => {
                      const isAtRisk = student.total > 0 && student.percentage < 75;
                      const isGood = student.percentage >= 75;

                      return (
                        <TableRow key={student.studentId} className="hover:bg-muted/20 transition-colors">
                          {/* Roll */}
                          <TableCell className="text-center font-mono font-bold text-foreground">
                            {student.rollNumber != null ? String(student.rollNumber).padStart(2, "0") : "—"}
                          </TableCell>

                          {/* Profile */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9 rounded-xl shrink-0">
                                {student.profileImageUrl ? (
                                  <AvatarImage
                                    src={student.profileImageUrl}
                                    alt={`${student.firstName} ${student.lastName}`}
                                    className="rounded-xl object-cover"
                                  />
                                ) : null}
                                <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-bold text-primary">
                                  {getInitials(student.firstName, student.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-bold text-foreground">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="font-mono text-[11px] text-muted-foreground">
                                  {student.enrollmentNumber}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Cohort */}
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] font-semibold">
                              {student.programCode || "—"} · Sem {student.semester || "—"}
                            </Badge>
                          </TableCell>

                          {/* Attended Fraction */}
                          <TableCell className="text-center font-bold text-xs text-foreground">
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{student.present}</span>
                            <span className="text-muted-foreground font-normal"> / {student.total}</span>
                          </TableCell>

                          {/* Attendance Progress */}
                          <TableCell>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold tabular-nums">
                                  {student.percentage}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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

                          {/* Action Button */}
                          <TableCell className="text-right pr-5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openStudentHistory(student.studentId)}
                              className="h-7 text-xs font-semibold gap-1 px-2.5"
                              title="View individual attendance logs"
                            >
                              <IconListCheck className="size-3.5" aria-hidden="true" />
                              Logs
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {filteredRoster.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-3 bg-muted/5">
                <p className="text-xs text-muted-foreground">
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
                    className="h-8 text-xs font-semibold"
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rosterPage >= totalRosterPages}
                    onClick={() => setRosterPage((p) => Math.min(totalRosterPages, p + 1))}
                    className="h-8 text-xs font-semibold"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── View 2: Conducted Sessions Table ── */}
        {activeView === "sessions" && (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow className="border-b border-border/70">
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Session Date</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Subject &amp; Cohort</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Day &amp; Time Slot</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Type</TableHead>
                    <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Turnout</TableHead>
                    <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Rate</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase tracking-wider pr-5">Roll Sheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
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
                          ? Number(((presentCount / totalCount) * 100).toFixed(0))
                          : 0;

                      return (
                        <TableRow key={session.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-semibold text-xs text-foreground">
                            {formatDisplayDate(session.sessionDate)}
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-bold text-foreground">
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
                          <TableCell className="text-center text-xs font-semibold">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{presentCount}</span>
                            <span className="text-muted-foreground"> / </span>
                            <span className="text-rose-600 dark:text-rose-400">{totalCount - presentCount}</span>
                          </TableCell>
                          <TableCell className="text-center font-extrabold tabular-nums text-xs">
                            <Badge
                              variant="outline"
                              className={`text-[10px] border-transparent ${
                                rate >= 75
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {rate}%
                            </Badge>
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
                              className="h-7 gap-1 text-xs font-semibold px-2.5"
                            >
                              <IconListCheck className="size-3" aria-hidden="true" />
                              Roll Sheet
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

      {/* ── Modal 1: Individual Student History ── */}
      <Dialog
        open={Boolean(studentModalData || loadingStudentModal)}
        onOpenChange={(open) => {
          if (!open) {
            setStudentModalData(null);
            setLoadingStudentModal(false);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] sm:max-w-3xl lg:max-w-4xl flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 border-b border-border/70 bg-card shrink-0">
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <IconListCheck className="size-5 text-primary" aria-hidden="true" />
              Student Attendance Logs
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Chronological session logs grouped by date across all enrolled subjects
            </DialogDescription>
          </DialogHeader>

          {loadingStudentModal ? (
            <div className="flex min-h-64 items-center justify-center p-8">
              <div className="flex flex-col items-center gap-2">
                <IconLoader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">Loading attendance logs...</p>
              </div>
            </div>
          ) : studentModalData ? (
            <>
              <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
                {/* Student Summary Banner */}
                <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3.5">
                    <Avatar className="size-12 border border-border/70 shadow-xs">
                      <AvatarImage src={studentModalData.student.profileImageUrl ?? undefined} />
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {studentModalData.student.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-base font-extrabold text-foreground">
                        {studentModalData.student.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-0.5">
                        <span>
                          Enrollment: <strong className="text-foreground">{studentModalData.student.enrollmentNumber}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Roll: <strong className="text-foreground">{studentModalData.student.rollNumber ?? "—"}</strong>
                        </span>
                        <span>·</span>
                        <span className="font-medium text-foreground">
                          {studentModalData.student.programCode} (Sem {studentModalData.student.semester})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:border-l sm:border-border/70 sm:pl-5">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Overall</p>
                      <p
                        className={`text-2xl font-black ${
                          studentModalData.stats.percentage >= 75
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        }`}
                      >
                        {studentModalData.stats.percentage}%
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {studentModalData.stats.presentSessions} of {studentModalData.stats.totalSessions} sessions
                      </p>
                    </div>
                  </div>
                </div>

                {/* Attendance Shortage Warning */}
                {studentModalData.stats.percentage < 75 && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <IconAlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <strong className="font-bold">Institutional Attendance Warning</strong>
                      <p className="mt-0.5">
                        Attended {studentModalData.stats.presentSessions} of{" "}
                        {studentModalData.stats.totalSessions} sessions ({studentModalData.stats.percentage}%).
                        University regulations require at least 75% attendance for exam eligibility.
                      </p>
                    </div>
                  </div>
                )}

                {/* Grouped Logs by Date */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Session Logs by Date ({groupedStudentHistory.length} {groupedStudentHistory.length === 1 ? "day" : "days"})
                    </h5>
                    <span className="text-xs text-muted-foreground">
                      {studentModalData.history.length} total logged {studentModalData.history.length === 1 ? "session" : "sessions"}
                    </span>
                  </div>

                  {groupedStudentHistory.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 py-10 text-center text-xs text-muted-foreground">
                      No sessions recorded in this period.
                    </div>
                  ) : (
                    groupedStudentHistory.map((group) => (
                      <div
                        key={group.dateKey}
                        className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs hover:border-primary/30 transition-colors"
                      >
                        {/* Noticeable Date Header Separator */}
                        <div className="bg-muted/40 px-4 py-2.5 border-b border-border/70 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <IconCalendar className="size-4" aria-hidden="true" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">
                                {group.displayDate}
                              </span>
                              {group.weekday && (
                                <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-md bg-muted/80 border border-border/50">
                                  {group.weekday}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium">
                              {group.items.length} {group.items.length === 1 ? "session" : "sessions"}
                            </span>
                            {group.absentCount === 0 ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent text-[11px] font-semibold"
                              >
                                <IconCheck className="size-3 mr-1" /> All Present
                              </Badge>
                            ) : group.presentCount === 0 ? (
                              <Badge
                                variant="outline"
                                className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-transparent text-[11px] font-semibold"
                              >
                                <IconX className="size-3 mr-1" /> All Absent
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent text-[10px] font-semibold"
                                >
                                  {group.presentCount} Present
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-transparent text-[10px] font-semibold"
                                >
                                  {group.absentCount} Absent
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sessions inside this Date */}
                        <div className="divide-y divide-border/60">
                          {group.items.map((h) => (
                            <div
                              key={h.sessionId}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/15 transition-colors"
                            >
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-foreground">
                                    {h.subjectName}
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    ({h.subjectCode})
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] font-semibold uppercase tracking-wider py-0 px-1.5"
                                  >
                                    {h.type}
                                  </Badge>
                                  {h.group && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-medium py-0 px-1.5"
                                    >
                                      {h.group}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1 font-mono text-[11px]">
                                    <IconClock className="size-3 text-muted-foreground/70" />
                                    {formatTimeSlot(h.startTime, h.endTime)}
                                  </span>
                                  {h.note && (
                                    <span className="text-[11px] italic text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
                                      Note: {h.note}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center">
                                {h.status === "PRESENT" ? (
                                  <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 border-transparent dark:text-emerald-400 text-xs font-bold px-2.5 py-1">
                                    <IconCheck className="size-3.5 mr-1" />
                                    Present
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs font-bold px-2.5 py-1">
                                    <IconX className="size-3.5 mr-1" />
                                    Absent
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:px-6 border-t border-border/70 bg-card flex items-center justify-between shrink-0 text-xs text-muted-foreground">
                <span>
                  Showing {studentModalData.history.length} logged {studentModalData.history.length === 1 ? "session" : "sessions"} across {groupedStudentHistory.length} {groupedStudentHistory.length === 1 ? "date" : "dates"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentModalData(null)}
                  className="h-8 text-xs font-semibold px-4"
                >
                  Close
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Modal 2: Session Roll Sheet ── */}
      <Dialog
        open={Boolean(selectedSessionForRoll)}
        onOpenChange={(open) => {
          if (!open) setSelectedSessionForRoll(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Roll Sheet: {selectedSessionForRoll ? formatDisplayDate(selectedSessionForRoll.sessionDate) : ""}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
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
                {/* Session Turnout Metrics Strip */}
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-muted/15 p-3 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Enrolled</p>
                    <p className="text-base font-extrabold text-foreground">{allRecords.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Present</p>
                    <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {presentRecords.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Absent</p>
                    <p className="text-base font-extrabold text-rose-600 dark:text-rose-400">{absentRecords.length}</p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
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

                  <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border/60 bg-muted/40">
                    <button
                      type="button"
                      onClick={() => setSessionRollFilter("all")}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        sessionRollFilter === "all"
                          ? "bg-background text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All ({allRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionRollFilter("present")}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        sessionRollFilter === "present"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-emerald-700 dark:text-emerald-300 hover:text-emerald-800"
                      }`}
                    >
                      Present ({presentRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionRollFilter("absent")}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        sessionRollFilter === "absent"
                          ? "bg-rose-600 text-white shadow-2xs"
                          : "text-rose-700 dark:text-rose-300 hover:text-rose-800"
                      }`}
                    >
                      Absent ({absentRecords.length})
                    </button>
                  </div>
                </div>

                {/* Roll Call Table */}
                <div className="overflow-x-auto rounded-xl border border-border/70 max-h-80">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="w-16 text-center font-bold text-xs uppercase">Roll</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Student Name</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Enrollment</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase pr-4">Status</TableHead>
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
                            <TableCell className="text-center font-mono font-bold text-xs text-foreground">
                              {rec.student.rollNumber != null ? String(rec.student.rollNumber).padStart(2, "0") : "—"}
                            </TableCell>
                            <TableCell className="font-bold text-xs text-foreground">
                              {rec.student.user.firstName} {rec.student.user.lastName}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {rec.student.enrollmentNumber}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              {rec.status === "PRESENT" ? (
                                <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 border-transparent dark:text-emerald-400 text-[10px] font-bold">
                                  <IconCheck className="size-3 mr-1" />
                                  Present
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px] font-bold">
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
