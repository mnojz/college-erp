"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/components/teacher/TeacherShell";
import { Avatar } from "@/app/components/profile/Avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricGridSkeleton, SectionSkeleton } from "@/app/components/layout/PageSkeletons";
import { formatTime } from "@/app/lib/timetable-layout";
import { campusDayOfWeek, campusMinutesOfDay } from "@/app/lib/campus-time";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import {
  IconAlertCircle,
  IconArrowRight,
  IconBell,
  IconBook2,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarClock,
  IconCalendarEvent,
  IconChevronRight,
  IconClipboardCheck,
  IconFileDescription,
  IconHierarchy2,
  IconId,
  IconMail,
  IconPaperclip,
  IconSchool,
  IconUpload,
  IconUsersGroup,
  IconZoomIn,
} from "@tabler/icons-react";
import { ProfileImagePreviewModal } from "@/app/components/profile/ProfileImagePreviewModal";

type TeacherClass = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: { id: string; name: string; code: string };
  program: {
    id: string;
    name: string;
    code: string;
    departmentName: string;
    students: Array<{ id: string }>;
  };
  semester: number;
  _count: { sessions: number };
};

type TeacherData = {
  id: string;
  employeeNo: string;
  profileImageUrl: string | null;
  office: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  classes: TeacherClass[];
};

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  author: { firstName: string; lastName: string } | null;
  subject: { id: string; name: string; code: string } | null;
  program: { id: string; name: string; code: string } | null;
  semester: number | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
};

type ExamSubjectItem = {
  examSubjectId: string;
  sessionId: string;
  part: string;
  maxMarks: number;
  subject: { id: string; code: string; name: string };
  session: {
    id: string;
    title: string;
    type: string;
    status: string;
    semester: number;
    program: { name: string; code: string };
  };
  markCount: number;
  registeredCount: number;
};

const DAYS_OF_WEEK = [
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
  { key: "SATURDAY", label: "Sat" },
] as const;

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatNoticeDate(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function TeacherOverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<TeacherData | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [pendingExams, setPendingExams] = useState<ExamSubjectItem[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<AnnouncementItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(() => campusDayOfWeek());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);

  const todayDayName = campusDayOfWeek();
  const displayDayName = todayDayName.charAt(0) + todayDayName.slice(1).toLowerCase();
  const mins = campusMinutesOfDay();
  const greeting = getGreeting(Math.floor(mins / 60));

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [profRes, noticeRes, examRes] = await Promise.allSettled([
          fetch("/api/teacher/profile"),
          fetch("/api/announcements"),
          fetch("/api/teacher/exams"),
        ]);

        if (profRes.status === "fulfilled") {
          const res = profRes.value;
          if (res.status === 401 || res.status === 403) {
            router.replace("/dashboard");
            return;
          }
          const resJson = await res.json();
          if (!res.ok) {
            if (!cancelled) setError(resJson.error ?? "Failed to load teacher profile");
            return;
          }
          if (!cancelled) {
            setData(resJson.teacher);
          }
        } else {
          if (!cancelled) setError("Unable to load profile data");
        }

        // Optional notices feed
        if (noticeRes.status === "fulfilled" && noticeRes.value.ok) {
          try {
            const noticeJson = await noticeRes.value.json();
            if (!cancelled && Array.isArray(noticeJson.announcements)) {
              setAnnouncements(noticeJson.announcements.slice(0, 4));
            }
          } catch {
            // Silently ignore secondary widget error
          }
        }

        // Optional pending exams feed
        if (examRes.status === "fulfilled" && examRes.value.ok) {
          try {
            const examJson = await examRes.value.json();
            if (!cancelled && Array.isArray(examJson.items)) {
              const pending = examJson.items.filter(
                (item: ExamSubjectItem) => item.markCount < item.registeredCount
              );
              setPendingExams(pending);
            }
          } catch {
            // Silently ignore secondary widget error
          }
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Unable to reach the server");
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Derived collections
  const classes = data?.classes ?? [];
  const activeDayKey = selectedDay || todayDayName;
  const activeDayClasses = classes.filter((c) => c.dayOfWeek === activeDayKey);
  const todaysClasses = classes.filter((c) => c.dayOfWeek === todayDayName);

  // Class counts by day
  const classCountByDay: Record<string, number> = {};
  for (const c of classes) {
    classCountByDay[c.dayOfWeek] = (classCountByDay[c.dayOfWeek] || 0) + 1;
  }

  // Unique subjects
  const uniqueSubjectsMap = new Map<
    string,
    { code: string; name: string; program: string; semester: number; studentCount: number; id: string }
  >();
  for (const c of classes) {
    if (!uniqueSubjectsMap.has(c.subject.id)) {
      uniqueSubjectsMap.set(c.subject.id, {
        id: c.subject.id,
        code: c.subject.code,
        name: c.subject.name,
        program: c.program.code,
        semester: c.semester,
        studentCount: c.program.students.length,
      });
    }
  }
  const uniqueSubjects = Array.from(uniqueSubjectsMap.values());

  // Metrics
  let totalStudents = 0;
  let totalSessionsLogged = 0;
  let departmentName = "Department Faculty";

  if (classes.length > 0) {
    const studentIdSet = new Set<string>();
    for (const c of classes) {
      totalSessionsLogged += c._count.sessions;
      for (const s of c.program.students) {
        studentIdSet.add(s.id);
      }
    }
    totalStudents = studentIdSet.size;
    departmentName = classes[0]?.program.departmentName || "Engineering Faculty";
  }

  if (error) {
    return (
      <main className="grid min-h-[50vh] place-items-center px-6 text-sm font-semibold text-destructive">
        <div className="text-center space-y-3">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.replace("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <TeacherShell active="/dashboard" title="Faculty Overview" subtitle="Teacher Portal">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <MetricGridSkeleton count={4} />
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
            <SectionSkeleton rows={4} />
            <SectionSkeleton rows={4} />
          </div>
        </div>
      </TeacherShell>
    );
  }

  const fullName = `${data.user.firstName} ${data.user.lastName}`.trim();

  const noticeDetailData: NoticeDetailData | null = selectedNotice
    ? {
        id: selectedNotice.id,
        title: selectedNotice.title,
        body: selectedNotice.body,
        publishedAt: selectedNotice.publishedAt,
        createdAt: selectedNotice.createdAt,
        author: selectedNotice.author,
        attachment: selectedNotice.attachmentFileName
          ? {
              fileName: selectedNotice.attachmentFileName,
              mimeType: selectedNotice.attachmentMimeType || "application/octet-stream",
              size: selectedNotice.attachmentSize || 0,
            }
          : null,
        scope:
          selectedNotice.subject && selectedNotice.program && selectedNotice.semester
            ? {
                subjectName: selectedNotice.subject.name,
                subjectCode: selectedNotice.subject.code,
                programName: selectedNotice.program.name,
                programCode: selectedNotice.program.code,
                semester: selectedNotice.semester,
              }
            : null,
      }
    : null;

  return (
    <TeacherShell
      active="/dashboard"
      title="Faculty Overview"
      subtitle="Teacher Portal"
      teacherName={fullName}
      employeeNo={data.employeeNo}
      avatarUrl={data.profileImageUrl}
    >
      <div className="space-y-6">
        {/* ── 1. Faculty Header Banner (Clean, Focused, No Fluff) ── */}
        <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-6 shadow-xs">
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Identity & Metadata */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setShowImagePreview(true)}
                className="group relative shrink-0 rounded-2xl shadow-xs ring-1 ring-border overflow-hidden cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-transform duration-200 hover:scale-[1.03]"
                title="Click to view full photo"
                aria-label="View enlarged profile photo"
              >
                <Avatar name={fullName} photoUrl={data.profileImageUrl} size={68} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white backdrop-blur-[1px]">
                  <IconZoomIn className="size-5 drop-shadow-md" aria-hidden="true" />
                </div>
              </button>

              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {greeting}, {data.user.firstName}
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
                  {fullName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <IconSchool size={15} className="text-primary" />
                    {departmentName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconId size={15} />
                    ID: <strong className="text-foreground">{data.employeeNo}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconMail size={15} />
                    {data.user.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
              <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
                <Link href="/teacher/attendance">
                  <IconCalendarCheck size={16} />
                  Take Attendance
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                <Link href="/teacher/exams">
                  <IconClipboardCheck size={16} />
                  Exam Marks
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                <Link href="/teacher/materials">
                  <IconUpload size={16} />
                  Upload Notes
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── 2. Key Metrics Grid ── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Today's Classes */}
          <Card className="p-4 sm:p-5 rounded-xl border border-border/70 shadow-xs bg-card hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Today&apos;s Classes</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconCalendarEvent size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{todaysClasses.length}</div>
            <span className="text-xs text-muted-foreground">
              {todaysClasses.length > 0 ? `${todaysClasses.length} lecture${todaysClasses.length !== 1 ? "s" : ""} scheduled` : `Lecture-free (${displayDayName})`}
            </span>
          </Card>

          {/* Card 2: Teaching Subjects */}
          <Card className="p-4 sm:p-5 rounded-xl border border-border/70 shadow-xs bg-card hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Assigned Subjects</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <IconBook2 size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{uniqueSubjects.length}</div>
            <span className="text-xs text-muted-foreground">Active course modules</span>
          </Card>

          {/* Card 3: Enrolled Students */}
          <Card className="p-4 sm:p-5 rounded-xl border border-border/70 shadow-xs bg-card hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Students Reach</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <IconUsersGroup size={18} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{totalStudents}</div>
            <span className="text-xs text-muted-foreground">Enrolled in your cohorts</span>
          </Card>

          {/* Card 4: Actionable Status (Pending Marks or Sessions Logged) */}
          {pendingExams.length > 0 ? (
            <Link href="/teacher/exams" className="group block">
              <Card className="p-4 sm:p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 group-hover:border-amber-500/60 shadow-xs transition-colors">
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Pending Marks</span>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    <IconAlertCircle size={18} />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-800 dark:text-amber-200">
                  {pendingExams.length}
                </div>
                <span className="text-xs text-amber-700/80 dark:text-amber-300/80 flex items-center gap-1 group-hover:underline">
                  Evaluation needed <IconArrowRight size={12} />
                </span>
              </Card>
            </Link>
          ) : (
            <Link href="/teacher/attendance?tab=records" className="group block">
              <Card className="p-4 sm:p-5 rounded-xl border border-border/70 shadow-xs bg-card group-hover:border-primary/60 transition-colors">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-primary transition-colors">
                    Sessions Logged
                  </span>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <IconClipboardCheck size={18} />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-foreground group-hover:text-primary transition-colors">
                  {totalSessionsLogged}
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1 group-hover:text-foreground transition-colors">
                  View attendance logs <IconArrowRight size={12} />
                </span>
              </Card>
            </Link>
          )}
        </section>

        {/* ── 3. Primary Working Workspace (2 Columns) ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Left Column: Schedule with Interactive Day Picker + Subject Hub */}
          <div className="space-y-6">
            {/* 3A: Interactive Class Schedule with Day Selector */}
            <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden flex flex-col">
              <CardHeader className="border-b bg-muted/10 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <IconCalendarClock size={18} className="text-primary" />
                  <CardTitle className="text-sm font-bold text-foreground">
                    Teaching Schedule
                  </CardTitle>
                </div>

                <div className="flex items-center gap-3">
                  <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs font-semibold">
                    <Link href="/teacher/schedule">
                      <span className="inline-flex items-center gap-1 text-primary">
                        Weekly Timetable <IconChevronRight size={14} />
                      </span>
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              {/* Day Pills Bar */}
              <div className="flex items-center gap-1.5 px-5 py-2.5 bg-muted/5 border-b border-border/50 overflow-x-auto">
                {DAYS_OF_WEEK.map((day) => {
                  const isToday = day.key === todayDayName;
                  const isSelected = day.key === activeDayKey;
                  const count = classCountByDay[day.key] || 0;

                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedDay(day.key)}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                      }`}
                    >
                      <span>{day.label}</span>
                      {count > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                      {isToday && (
                        <span
                          className={`size-1.5 rounded-full ${
                            isSelected ? "bg-primary-foreground" : "bg-primary"
                          }`}
                          title="Today"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Class List for Selected Day */}
              <CardContent className="p-5 flex-1 flex flex-col justify-center">
                {activeDayClasses.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground space-y-2">
                    <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <IconCalendar size={20} />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      No lectures scheduled on {selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeDayClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/5 hover:bg-muted/15 hover:border-primary/40 transition-all"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Time Slot Badge */}
                          <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 min-w-[82px] text-center">
                            <span className="text-xs font-bold leading-tight font-mono">
                              {formatTime(cls.startTime)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatTime(cls.endTime)}
                            </span>
                          </div>

                          {/* Subject & Details */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-mono font-semibold">
                                {cls.subject.code}
                              </Badge>
                              <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                                {cls.subject.name}
                              </h4>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {cls.program.name} ({cls.program.code}) • Semester {cls.semester}
                            </p>
                          </div>
                        </div>

                        {/* Direct Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button asChild size="sm" className="h-8 text-xs font-semibold px-3 gap-1.5 shadow-2xs">
                            <Link href={`/teacher/attendance?classId=${cls.id}`}>
                              <IconCalendarCheck size={14} />
                              Attendance
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold px-2.5 gap-1">
                            <Link href={`/teacher/materials?subjectId=${cls.subject.id}`} title="Share Notes">
                              <IconUpload size={14} />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3B: Teaching Subjects Hub */}
            <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden flex flex-col">
              <CardHeader className="border-b bg-muted/10 px-5 py-3.5 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconBook2 size={18} className="text-primary" />
                  <CardTitle className="text-sm font-bold text-foreground">
                    Assigned Courses &amp; Modules
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-xs font-semibold">
                  {uniqueSubjects.length} courses
                </Badge>
              </CardHeader>

              <CardContent className="p-5">
                {uniqueSubjects.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No teaching subjects currently assigned.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {uniqueSubjects.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/5 hover:bg-muted/15 transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono font-semibold">
                              {sub.code}
                            </Badge>
                            <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                              {sub.name}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground mt-1">
                            <span>{sub.program}</span>
                            <span>•</span>
                            <span>Semester {sub.semester}</span>
                            <span>•</span>
                            <span>{sub.studentCount} students</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button asChild variant="outline" size="sm" className="h-7 text-xs font-semibold px-2.5 gap-1">
                            <Link href="/teacher/attendance?tab=records">
                              <IconClipboardCheck size={13} className="text-primary" />
                              Records
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm" className="h-7 text-xs font-semibold px-2.5 gap-1">
                            <Link href={`/teacher/materials?subjectId=${sub.id}`}>
                              <IconUpload size={13} />
                              Notes
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Priority Tasks, Announcements & Library */}
          <div className="space-y-6">
            {/* 3C: Pending Exam Evaluations (Actionable Alert Card) */}
            {pendingExams.length > 0 && (
              <Card className="rounded-xl border border-amber-500/40 bg-amber-500/5 shadow-xs overflow-hidden">
                <CardHeader className="border-b border-amber-500/20 px-5 py-3 flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <IconAlertCircle size={18} />
                    <CardTitle className="text-xs font-bold uppercase tracking-wider">
                      Pending Marks Entry
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="border-amber-600/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold">
                    {pendingExams.length} Pending
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-2.5">
                  {pendingExams.map((exam) => (
                    <div
                      key={exam.examSubjectId}
                      className="p-3 rounded-lg border border-amber-500/20 bg-background/80 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                            {exam.subject.code}
                          </span>
                          <span className="text-xs font-bold text-foreground truncate">
                            {exam.subject.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {exam.session.title} • {exam.markCount}/{exam.registeredCount} graded
                        </div>
                      </div>

                      <Button asChild size="sm" className="h-7 text-xs font-semibold px-2.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                        <Link href="/teacher/exams">
                          Grade
                        </Link>
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 3D: Live Announcements & Campus Notices */}
            <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden flex flex-col">
              <CardHeader className="border-b bg-muted/10 px-5 py-3.5 flex flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <IconBell size={18} className="text-primary" />
                  <CardTitle className="text-sm font-bold text-foreground">
                    Campus Notices
                  </CardTitle>
                </div>

                <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs font-semibold">
                  <Link href="/teacher/announcements">
                    <span className="inline-flex items-center gap-1 text-primary">
                      All Notices <IconChevronRight size={14} />
                    </span>
                  </Link>
                </Button>
              </CardHeader>

              <CardContent className="p-4">
                {announcements.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No active notices published.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {announcements.map((notice) => (
                      <button
                        key={notice.id}
                        type="button"
                        onClick={() => setSelectedNotice(notice)}
                        className="w-full text-left p-3 rounded-xl border border-border/60 bg-muted/5 hover:bg-muted/15 hover:border-primary/40 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {notice.title}
                          </h4>
                          <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                            {formatNoticeDate(notice.publishedAt || notice.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {notice.body}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          {notice.author && (
                            <span>By {notice.author.firstName} {notice.author.lastName}</span>
                          )}
                          {notice.attachmentFileName && (
                            <span className="inline-flex items-center gap-1 text-primary font-medium">
                              <IconPaperclip size={11} />
                              Attachment
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3E: Quick Academic Library Shortcuts */}
            <Card className="rounded-xl border border-border/70 shadow-xs overflow-hidden">
              <CardHeader className="border-b bg-muted/10 px-5 py-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Institutional Library
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-2 gap-2">
                <Link
                  href="/teacher/resources?tab=syllabus"
                  className="flex flex-col items-center justify-center p-3.5 rounded-lg border border-border/60 bg-muted/5 hover:bg-muted/20 hover:border-primary/40 transition-all text-center group"
                >
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <IconFileDescription size={16} />
                  </div>
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Syllabus Library
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Official outlines
                  </span>
                </Link>

                <Link
                  href="/teacher/resources?tab=structure"
                  className="flex flex-col items-center justify-center p-3.5 rounded-lg border border-border/60 bg-muted/5 hover:bg-muted/20 hover:border-primary/40 transition-all text-center group"
                >
                  <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <IconHierarchy2 size={16} />
                  </div>
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Course Structure
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Degrees &amp; credits
                  </span>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── 4. Notice Preview Modal ── */}
      {selectedNotice && noticeDetailData && (
        <NoticeDetailModal
          notice={noticeDetailData}
          onClose={() => setSelectedNotice(null)}
        />
      )}

      {/* ── 5. Profile Picture Preview Modal ── */}
      <ProfileImagePreviewModal
        open={showImagePreview}
        onOpenChange={setShowImagePreview}
        imageUrl={data.profileImageUrl}
        name={fullName}
        subtitle={departmentName}
        badge={data.employeeNo ? `ID: ${data.employeeNo}` : undefined}
      />
    </TeacherShell>
  );
}
