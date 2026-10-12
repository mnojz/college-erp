"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconCalendarCheck,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
} from "@tabler/icons-react";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "cn";

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: number | null;
  profileImageUrl: string | null;
  currentSemester: number | null;
  user: { email: string; firstName: string; lastName: string };
  program: { id: string; name: string; code: string } | null;
};

/** A subject in the current semester — shown whether or not attendance exists yet. */
type SubjectOption = {
  id: string;
  name: string;
  code: string;
  programId: string;
  semester: number;
};

type AttendanceRecord = {
  /** Stable row key — a subject can have two slots on the same day. */
  id: string;
  status: "PRESENT" | "ABSENT";
  session: {
    sessionDate: string;
    class: {
      subject: { code: string; name: string };
      semester?: number;
    };
  };
};

/**
 * Catppuccin accents used for the per-subject squares in the log + legend.
 * Scoped to this page rather than reusing the timetable PALETTE, so every
 * subject a student has records for gets its own colour and the legend stays
 * unambiguous even with 40+ subjects across a full program.
 */
const SUBJECT_COLORS = [
  "blue", "green", "peach", "mauve", "teal", "red", "yellow",
  "lavender", "pink", "sapphire", "maroon", "sky", "flamingo", "rosewater",
] as const;

/**
 * Attendance is advisory, not a pass/fail gate — there is no eligibility
 * threshold. The percentage is colour-banded only: red below 50%, yellow from
 * 50–70%, green above 70%.
 */
function attendanceBand(pct: number): "red" | "yellow" | "green" {
  if (pct < 50) return "red";
  if (pct <= 70) return "yellow";
  return "green";
}

const BAND_COLOR = {
  red: "var(--ctp-red)",
  yellow: "var(--ctp-yellow)",
  green: "var(--ctp-green)",
} as const;

const BAND_MESSAGE = {
  red: "Attendance is low — attend more classes",
  yellow: "Attendance is getting low",
  green: "Attendance is healthy",
} as const;

export default function StudentAttendancePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");

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
        // The subject catalog is public and optional: if it fails we fall back
        // to the records-only view so the page still renders.
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

  /**
   * Subjects the student is enrolled in THIS semester. Prefer the real
   * catalog (so a subject shows up the moment the semester starts, before any
   * attendance is taken); fall back to the subjects seen in the records if the
   * catalog is unavailable or program/semester isn't set.
   */
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

  /**
   * One colour per subject, assigned in the enrolled-subject order (not the
   * filtered subset) so a colour never shifts when the filter changes.
   */
  const subjectColorByCode = useMemo(() => {
    const map = new Map<string, string>();
    enrolledSubjects.forEach((sub, i) => {
      map.set(sub.code, `var(--ctp-${SUBJECT_COLORS[i % SUBJECT_COLORS.length]})`);
    });
    return map;
  }, [enrolledSubjects]);

  /**
   * Per-subject present/total, seeded from the enrolled-subject list so every
   * subject appears (0/0 until attendance is recorded), then filled from records.
   */
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

  if (error) {
    return (
      <StudentShell title="Lecture & Lab Attendance Records" active="/student/attendance">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      </StudentShell>
    );
  }
  if (loading || !profile) {
    return (
      <StudentShell title="Lecture & Lab Attendance Records" active="/student/attendance">
        <Skeleton className="h-40 w-full" />
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  // Roll numbers are integers now; StudentShell takes a display string.
  const studentId = profile.rollNumber != null ? String(profile.rollNumber) : profile.enrollmentNumber;

  const totalSessions = records.length;
  const presentSessions = records.filter((r) => r.status === "PRESENT").length;
  const absentSessions = totalSessions - presentSessions;
  const overallPercentage =
    totalSessions > 0 ? ((presentSessions / totalSessions) * 100).toFixed(1) : "0";

  const filteredRecords =
    selectedSubject === "ALL"
      ? records
      : records.filter((r) => r.session.class.subject.code === selectedSubject);

  /**
   * The log is grouped by date: one row per session date, each holding that
   * day's subject chips. Newest date first.
   */
  const recordsByDate = new Map<string, AttendanceRecord[]>();
  for (const record of filteredRecords) {
    const date = record.session.sessionDate;
    const bucket = recordsByDate.get(date);
    if (bucket) bucket.push(record);
    else recordsByDate.set(date, [record]);
  }
  const datedLogs = Array.from(recordsByDate.entries()).sort((a, b) =>
    b[0].localeCompare(a[0]),
  );

  /** Subjects shown in the legend — every enrolled subject, so it never empties. */
  const legendSubjects = enrolledSubjects;

  const overallBand = attendanceBand(Number(overallPercentage));

  return (
    <StudentShell
      active="/student/attendance"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Lecture & Lab Attendance Records"
      subtitle="Attendance Tracking"
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="py-3 px-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Overall Attendance</p>
                <span
                  className="flex size-6 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in oklab, ${BAND_COLOR[overallBand]} 15%, transparent)`, color: BAND_COLOR[overallBand] }}
                >
                  <IconClipboardList size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-1.5 text-xl font-bold" style={{ color: BAND_COLOR[overallBand] }}>
                {overallPercentage}%
              </p>
              <small className="block text-xs leading-tight text-muted-foreground">{BAND_MESSAGE[overallBand]}</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Total Classes</p>
                <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconCalendarCheck size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-1.5 text-xl font-bold">{totalSessions}</p>
              <small className="block text-xs leading-tight text-muted-foreground">Conducted sessions</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Present</p>
                <span className="flex size-6 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-(--ctp-green)">
                  <IconCircleCheck size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-1.5 text-xl font-bold text-(--ctp-green)">{presentSessions}</p>
              <small className="block text-xs leading-tight text-muted-foreground">Attended classes</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Absent</p>
                <span className="flex size-6 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <IconCircleX size={16} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-1.5 text-xl font-bold text-destructive">{absentSessions}</p>
              <small className="block text-xs leading-tight text-muted-foreground">Missed classes</small>
            </CardContent>
          </Card>
        </div>

        {/* Subject Breakdown */}
        {subjectStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subject-wise Attendance Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">
                Every subject in your current semester — bars fill in as attendance is recorded.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {subjectStats.map((sub) => {
                const pct = sub.total > 0 ? (sub.present / sub.total) * 100 : 0;
                const band = attendanceBand(pct);
                const color = subjectColorByCode.get(sub.code);
                const noData = sub.total === 0;
                return (
                  /* One compact line per subject: name absorbs the slack so the
                     present/total + bar + percentage cluster stays a fixed
                     right-aligned block and every bar is the same width. */
                  <div
                    key={sub.code}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/40 pb-2.5 last:border-0 last:pb-0"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <span
                        className="size-3 shrink-0 rounded-[5px]"
                        style={{ background: color }}
                        aria-hidden="true"
                      />
                      <strong className="shrink-0">{sub.code}</strong>
                      <span className="truncate text-muted-foreground">— {sub.name}</span>
                    </span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        noData ? "text-muted-foreground/60" : "text-muted-foreground"
                      }`}
                    >
                      {sub.present}/{sub.total}
                    </span>
                    <div className="h-2 w-36 shrink-0 overflow-hidden rounded-full bg-muted sm:w-44">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: BAND_COLOR[band] }}
                      />
                    </div>
                    <span
                      className="w-14 shrink-0 text-right text-sm font-bold tabular-nums"
                      style={{ color: noData ? "var(--muted-foreground)" : BAND_COLOR[band] }}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Filter Bar */}
        {subjectStats.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter Logs by Subject:</span>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="min-w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Subjects</SelectItem>
                {subjectStats.map((sub) => (
                  <SelectItem key={sub.code} value={sub.code}>
                    {sub.code} - {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Colour legend: maps each subject's square colour to the subject.
            Title on the top row, then subject entries in a wrapping grid —
            more than 8 subjects simply flow onto an extra row. */}
        {legendSubjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subjects</CardTitle>
              <p className="text-xs text-muted-foreground">
                Colour key for the squares in the daily log below.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2.5">
                {legendSubjects.map((subject) => (
                  <span
                    key={subject.code}
                    className="inline-flex min-w-40 items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-xs"
                  >
                    <span
                      className="size-3 shrink-0 rounded-[5px]"
                      style={{ background: subjectColorByCode.get(subject.code) }}
                      aria-hidden="true"
                    />
                    <span className="font-mono font-semibold">{subject.code}</span>
                    <span className="truncate text-muted-foreground">{subject.name}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Attendance Log — one row per date, subject chips inside.
            A chip's square carries the subject colour (see the legend) while
            the chip's border + background carry PRESENT (green) / ABSENT
            (neutral). */}
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-muted/30 px-4 py-12 text-center">
            <IconCalendarCheck className="size-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No attendance sessions recorded yet.</p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-56">Date</TableHead>
                    <TableHead>Subjects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datedLogs.map(([date, dayRecords]) => (
                    <TableRow key={date}>
                      <TableCell className="align-top font-medium whitespace-nowrap">
                        {new Date(date).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-4.5">
                          {dayRecords.map((item) => {
                            const present = item.status === "PRESENT";
                            const subject = item.session.class.subject;
                            return (
                              <span
                                key={item.id}
                                title={`${subject.name} — ${present ? "Present" : "Absent"}`}
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold",
                                  present
                                    ? "border-[color-mix(in_oklab,var(--ctp-green)_45%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-(--ctp-green)"
                                    : "border-border bg-muted/40 text-muted-foreground",
                                )}
                              >
                                <span
                                  className="size-3 shrink-0 rounded-[5px]"
                                  style={{
                                    background: subjectColorByCode.get(subject.code),
                                  }}
                                  aria-hidden="true"
                                />
                                {subject.code}
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </StudentShell>
  );
}
