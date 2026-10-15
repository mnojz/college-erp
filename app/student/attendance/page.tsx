"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconBook2,
  IconCalendar,
  IconCalendarCheck,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconFilter,
  IconInfoCircle,
  IconListCheck,
  IconSearch,
  IconTrendingUp,
  IconX,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string } | null;
};

type SubjectOption = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
};

type AttendanceRecord = {
  id: string;
  status: "PRESENT" | "ABSENT";
  note?: string | null;
  session: {
    sessionDate: string;
    class: {
      dayOfWeek?: string;
      startTime?: string;
      endTime?: string;
      semester?: number;
      subject: { code: string; name: string };
    };
  };
};


export default function StudentAttendancePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & View state
  const [activeTab, setActiveTab] = useState<"subjects" | "timeline">("subjects");
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, attRes, subjRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/student/attendance"),
          fetch("/api/subjects"),
        ]);

        if (!profileRes.ok || !attRes.ok) {
          router.replace("/dashboard");
          return;
        }

        const profileData = await profileRes.json();
        const attData = await attRes.json();

        setProfile(profileData.student);
        setRecords(attData.student?.attendanceRecords ?? []);
        if (subjRes.ok) {
          const subjData = await subjRes.json();
          setSubjects(subjData.subjects ?? []);
        }
      } catch {
        setError("Unable to load attendance records");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  /** Subjects the student is enrolled in this semester */
  const enrolledSubjects = useMemo(() => {
    const fromCatalog =
      profile?.program && profile.currentSemester != null
        ? subjects
            .filter(
              (s) =>
                s.programId === profile.program!.id &&
                s.semester === profile.currentSemester,
            )
            .map((s) => ({ code: s.code, name: s.name }))
        : [];
    if (fromCatalog.length > 0) return fromCatalog;
    const seen = new Map<string, { code: string; name: string }>();
    for (const r of records) {
      seen.set(r.session.class.subject.code, {
        code: r.session.class.subject.code,
        name: r.session.class.subject.name,
      });
    }
    return Array.from(seen.values());
  }, [subjects, records, profile]);

  /** Per-subject stats aggregated */
  const subjectStats = useMemo(() => {
    const map = new Map<string, { code: string; name: string; present: number; total: number }>();
    for (const sub of enrolledSubjects) {
      map.set(sub.code, { code: sub.code, name: sub.name, present: 0, total: 0 });
    }
    for (const record of records) {
      const code = record.session.class.subject.code;
      const current = map.get(code) ?? {
        code,
        name: record.session.class.subject.name,
        present: 0,
        total: 0,
      };
      current.total += 1;
      if (record.status === "PRESENT") current.present += 1;
      map.set(code, current);
    }
    return Array.from(map.values());
  }, [enrolledSubjects, records]);

  // Overall metric totals
  const totalSessions = records.length;
  const presentSessions = records.filter((r) => r.status === "PRESENT").length;
  const absentSessions = totalSessions - presentSessions;
  const overallPercentage =
    totalSessions > 0 ? (presentSessions / totalSessions) * 100 : 0;

  // Per-subject eligibility counts
  const qualifiedSubjects = useMemo(
    () => subjectStats.filter((s) => s.total > 0 && (s.present / s.total) * 100 >= 75),
    [subjectStats]
  );
  const atRiskSubjects = useMemo(
    () => subjectStats.filter((s) => s.total > 0 && (s.present / s.total) * 100 < 75),
    [subjectStats]
  );

  // Filtered session records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Subject filter
      if (selectedSubject !== "ALL" && r.session.class.subject.code !== selectedSubject) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const codeMatch = r.session.class.subject.code.toLowerCase().includes(query);
        const nameMatch = r.session.class.subject.name.toLowerCase().includes(query);
        const dateMatch = r.session.sessionDate.includes(query);
        return codeMatch || nameMatch || dateMatch;
      }
      return true;
    });
  }, [records, selectedSubject, statusFilter, searchQuery]);

  // Group filtered records by date (YYYY-MM-DD)
  const groupedByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        dateKey: string;
        displayDate: string;
        weekday: string;
        records: AttendanceRecord[];
        presentCount: number;
        absentCount: number;
      }
    >();

    for (const record of filteredRecords) {
      const rawDate = record.session.sessionDate;
      const key = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate.slice(0, 10);

      if (!map.has(key)) {
        const [year, month, day] = key.split("-").map(Number);
        const dateObj = new Date(year, (month || 1) - 1, day || 1);
        const displayDate = dateObj.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const weekday =
          record.session.class.dayOfWeek ||
          dateObj.toLocaleDateString("en-US", { weekday: "long" });

        map.set(key, {
          dateKey: key,
          displayDate,
          weekday,
          records: [],
          presentCount: 0,
          absentCount: 0,
        });
      }

      const dayGroup = map.get(key)!;
      dayGroup.records.push(record);
      if (record.status === "PRESENT") {
        dayGroup.presentCount += 1;
      } else {
        dayGroup.absentCount += 1;
      }
    }

    // Sort descending by date (most recent first)
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredRecords]);

  // Pagination by date groups (10 dates per page)
  const datesPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(groupedByDate.length / datesPerPage));
  const paginatedDateGroups = useMemo(() => {
    const start = (currentPage - 1) * datesPerPage;
    return groupedByDate.slice(start, start + datesPerPage);
  }, [groupedByDate, currentPage]);

  const allVisibleExpanded =
    paginatedDateGroups.length > 0 &&
    paginatedDateGroups.every((g) => expandedDates.has(g.dateKey));

  function toggleDateExpanded(dateKey: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }

  function toggleExpandAll() {
    if (allVisibleExpanded) {
      setExpandedDates(new Set());
    } else {
      setExpandedDates((prev) => {
        const next = new Set(prev);
        for (const g of paginatedDateGroups) {
          next.add(g.dateKey);
        }
        return next;
      });
    }
  }

  if (error) {
    return (
      <StudentShell title="My Attendance Records" active="/student/attendance">
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {error}
        </p>
      </StudentShell>
    );
  }

  if (loading || !profile) {
    return (
      <StudentShell title="Attendance" subtitle="Subject-wise attendance and exam eligibility" active="/student/attendance">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId =
    profile.rollNumber != null ? String(profile.rollNumber) : profile.enrollmentNumber;

  return (
    <StudentShell
      active="/student/attendance"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Attendance"
      subtitle="Subject-wise attendance and exam eligibility"
    >
      <div className="space-y-5">
        {/* ── Metric Stat Strip ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Stat 1: Subject Eligibility */}
          <Card className="rounded-xl border border-border/70 p-3.5 sm:p-4 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs sm:text-sm font-medium">Exam Qualified</span>
              {atRiskSubjects.length === 0 ? (
                <IconCircleCheck size={16} className="text-emerald-500" />
              ) : (
                <IconAlertTriangle size={16} className="text-amber-500" />
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {qualifiedSubjects.length}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                / {subjectStats.length}
              </span>
            </div>
          </Card>

          {/* Stat 2: Overall Average */}
          <Card className="rounded-xl border border-border/70 p-3.5 sm:p-4 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs sm:text-sm font-medium">Overall Rate</span>
              <IconTrendingUp size={16} className="text-primary" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {overallPercentage.toFixed(1)}%
            </div>
          </Card>

          {/* Stat 3: Total Attended */}
          <Card className="rounded-xl border border-border/70 p-3.5 sm:p-4 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs sm:text-sm font-medium">Classes Attended</span>
              <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <IconCheck size={13} />
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {presentSessions}
            </div>
          </Card>

          {/* Stat 4: Total Missed */}
          <Card className="rounded-xl border border-border/70 p-3.5 sm:p-4 shadow-xs bg-card">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs sm:text-sm font-medium">Classes Missed</span>
              <span className="flex size-5 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <IconX size={13} />
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-destructive">
              {absentSessions}
            </div>
          </Card>
        </div>

        {/* ── Main Content: Segmented Tabs View ── */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "subjects" | "timeline")}
          className="space-y-3.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2.5">
            <TabsList className="bg-muted/60 p-1 rounded-xl">
              <TabsTrigger
                value="subjects"
                className="gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <IconBook2 size={14} />
                Subject Breakdown ({enrolledSubjects.length})
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className="gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
              >
                <IconListCheck size={14} />
                Daily Logs ({groupedByDate.length} Days)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ════ TAB 1: SUBJECT BREAKDOWN (Compact Table Layout) ════ */}
          <TabsContent value="subjects" className="space-y-3 m-0 outline-hidden">
            {subjectStats.length === 0 ? (
              <Card className="rounded-2xl border-dashed p-10 text-center">
                <IconCalendarCheck className="size-8 text-muted-foreground/40 mx-auto" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No subjects found</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Subjects for your current semester will appear once assigned.
                </p>
              </Card>
            ) : (
              <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5">Subject</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-center py-2.5 w-32">Classes</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2.5 w-60">Attendance Rate</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-4 py-2.5 w-28">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectStats.map((sub) => {
                        const pct = sub.total > 0 ? (sub.present / sub.total) * 100 : 0;
                        const isGood = sub.total > 0 && pct >= 75;

                        return (
                          <TableRow key={sub.code} className="hover:bg-muted/30 transition-colors">
                            {/* Subject Code & Name */}
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs font-bold bg-muted/60 shrink-0 border-transparent">
                                  {sub.code}
                                </Badge>
                                <span className="text-xs font-semibold text-foreground line-clamp-1" title={sub.name}>
                                  {sub.name}
                                </span>
                              </div>
                            </TableCell>

                            {/* Attended / Total */}
                            <TableCell className="text-center py-2.5">
                              <span className="text-xs font-medium tabular-nums">
                                <strong className="text-foreground">{sub.present}</strong>
                                <span className="text-muted-foreground"> / {sub.total}</span>
                              </span>
                            </TableCell>

                            {/* Attendance Rate + Mini Progress Bar */}
                            <TableCell className="py-2.5">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className={`font-bold tabular-nums ${
                                      sub.total === 0
                                        ? "text-muted-foreground"
                                        : isGood
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {sub.total > 0 ? `${pct.toFixed(1)}%` : "—"}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      sub.total === 0
                                        ? "bg-muted"
                                        : isGood
                                        ? "bg-emerald-500"
                                        : pct >= 60
                                        ? "bg-amber-500"
                                        : "bg-destructive"
                                    }`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>

                            {/* View Logs Button */}
                            <TableCell className="text-right pr-4 py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs font-semibold px-2 hover:bg-muted"
                                onClick={() => {
                                  setSelectedSubject(sub.code);
                                  setActiveTab("timeline");
                                }}
                              >
                                View Logs →
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ════ TAB 2: DAILY LOGS (Grouped by Date) ════ */}
          <TabsContent value="timeline" className="space-y-3 m-0 outline-hidden">
            {/* Filter Toolbar */}
            <Card className="p-3 sm:p-3.5 rounded-xl border border-border/70 shadow-xs bg-card">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1 min-w-44">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by subject code, name, or date..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 text-xs h-8.5"
                  />
                </div>

                {/* Subject Dropdown & Status Filter */}
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedSubject}
                    onValueChange={(val) => {
                      setSelectedSubject(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-48 h-8.5 text-xs">
                      <IconFilter size={13} className="text-muted-foreground mr-1 shrink-0" />
                      <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Subjects</SelectItem>
                      {enrolledSubjects.map((sub) => (
                        <SelectItem key={sub.code} value={sub.code}>
                          {sub.code} — {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Status Filter Buttons */}
                  <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-muted/40 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("ALL");
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                        statusFilter === "ALL"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("PRESENT");
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                        statusFilter === "PRESENT"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("ABSENT");
                        setCurrentPage(1);
                      }}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                        statusFilter === "ABSENT"
                          ? "bg-destructive/15 text-destructive font-bold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Absent
                    </button>
                  </div>

                  {paginatedDateGroups.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleExpandAll}
                      className="h-8.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0 hidden sm:inline-flex"
                      title={allVisibleExpanded ? "Collapse all visible daily logs" : "Expand all visible daily logs"}
                    >
                      {allVisibleExpanded ? "Collapse All" : "Expand All"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Date-Grouped View */}
            {groupedByDate.length === 0 ? (
              <Card className="rounded-xl border-dashed p-10 text-center bg-card/60">
                <IconCalendarCheck className="size-8 text-muted-foreground/40 mx-auto" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No attendance records match your filter</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Try clearing the search query or selecting a different subject filter.
                </p>
                {(selectedSubject !== "ALL" || statusFilter !== "ALL" || searchQuery) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs font-medium"
                    onClick={() => {
                      setSelectedSubject("ALL");
                      setStatusFilter("ALL");
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </Card>
            ) : (
              <div className="space-y-3">
                {paginatedDateGroups.map((group) => {
                  const allPresent = group.absentCount === 0;
                  const allAbsent = group.presentCount === 0;
                  const isExpanded = expandedDates.has(group.dateKey);

                  return (
                    <Card
                      key={group.dateKey}
                      className="rounded-xl border border-border/70 shadow-xs overflow-hidden bg-card"
                    >
                      {/* Date Group Header */}
                      <button
                        type="button"
                        onClick={() => toggleDateExpanded(group.dateKey)}
                        aria-expanded={isExpanded}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left cursor-pointer select-none",
                          isExpanded && "border-b border-border/60"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <IconCalendar size={14} className="text-primary shrink-0" />
                          <span className="text-xs font-bold text-foreground">
                            {group.displayDate}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-semibold uppercase px-1.5 py-0 bg-background/80 shrink-0">
                            {group.weekday}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                            ({group.records.length} {group.records.length === 1 ? "subject" : "subjects"})
                          </span>
                        </div>

                        {/* Daily Summary Pill & Expand Indicator */}
                        <div className="flex items-center gap-2 shrink-0">
                          {allPresent ? (
                            <Badge
                              variant="outline"
                              className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold gap-1 py-0.5"
                            >
                              <IconCircleCheck size={11} className="text-emerald-500" />
                              All Present ({group.presentCount}/{group.records.length})
                            </Badge>
                          ) : allAbsent ? (
                            <Badge
                              variant="outline"
                              className="border-transparent bg-destructive/15 text-destructive text-[10px] font-bold gap-1 py-0.5"
                            >
                              <IconCircleX size={11} className="text-destructive" />
                              All Absent ({group.absentCount})
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {group.presentCount} Present
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-destructive">
                                {group.absentCount} Absent
                              </span>
                            </div>
                          )}

                          <IconChevronDown
                            size={16}
                            className={cn(
                              "text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180 text-foreground"
                            )}
                          />
                        </div>
                      </button>

                      {/* Subjects Taught on this Date */}
                      {isExpanded && (
                        <div className="divide-y divide-border/40">
                          {group.records.map((record) => {
                            const isPresent = record.status === "PRESENT";

                            return (
                              <div
                                key={record.id}
                                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
                              >
                                {/* Subject Info */}
                                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[11px] font-bold bg-muted/50 shrink-0"
                                  >
                                    {record.session.class.subject.code}
                                  </Badge>
                                  <span className="text-xs font-semibold text-foreground truncate">
                                    {record.session.class.subject.name}
                                  </span>
                                  {record.note && (
                                    <span className="text-[11px] text-muted-foreground italic truncate">
                                      — {record.note}
                                    </span>
                                  )}
                                </div>

                                {/* Present / Absent Badge */}
                                <div className="shrink-0">
                                  {isPresent ? (
                                    <Badge
                                      variant="outline"
                                      className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] gap-1 py-0.5 px-2"
                                    >
                                      <IconCheck size={12} className="text-emerald-500" />
                                      PRESENT
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="border-transparent bg-destructive/15 text-destructive font-bold text-[11px] gap-1 py-0.5 px-2"
                                    >
                                      <IconX size={12} className="text-destructive" />
                                      ABSENT
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <Card className="p-3 border border-border/70 shadow-xs bg-card flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Showing days {(currentPage - 1) * datesPerPage + 1} to{" "}
                      {Math.min(currentPage * datesPerPage, groupedByDate.length)} of {groupedByDate.length} days
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="h-7 w-7 p-0"
                        aria-label="Previous page"
                      >
                        <IconChevronLeft size={14} />
                      </Button>
                      <span className="font-semibold px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="h-7 w-7 p-0"
                        aria-label="Next page"
                      >
                        <IconChevronRight size={14} />
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </StudentShell>
  );
}
