"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  user: { email: string; firstName: string; lastName: string };
  program: { name: string; code: string } | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, attRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/student/attendance"),
        ]);

        if (!profileRes.ok || !attRes.ok) {
          router.replace("/dashboard");
          return;
        }

        const profileData = await profileRes.json();
        const attData = await attRes.json();

        setProfile(profileData.student);
        setRecords(attData.student?.attendanceRecords ?? []);
      } catch {
        setError("Unable to load attendance records");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

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

  const subjectMap = new Map<string, { code: string; name: string; present: number; total: number }>();
  for (const record of records) {
    const key = record.session.class.subject.code;
    const current = subjectMap.get(key) || {
      code: record.session.class.subject.code,
      name: record.session.class.subject.name,
      present: 0,
      total: 0,
    };
    current.total += 1;
    if (record.status === "PRESENT") current.present += 1;
    subjectMap.set(key, current);
  }

  const subjectStats = Array.from(subjectMap.values());

  const filteredRecords =
    selectedSubject === "ALL"
      ? records
      : records.filter((r) => r.session.class.subject.code === selectedSubject);

  /**
   * One colour per subject, assigned in first-seen order across ALL records
   * (not the filtered subset) so a colour never shifts when filtering changes.
   */
  const subjectColorByCode = new Map<string, string>();
  for (const record of records) {
    const code = record.session.class.subject.code;
    if (!subjectColorByCode.has(code)) {
      subjectColorByCode.set(
        code,
        `var(--ctp-${SUBJECT_COLORS[subjectColorByCode.size % SUBJECT_COLORS.length]})`,
      );
    }
  }

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

  /** Subjects that actually appear in the log — drives the colour legend. */
  const legendSubjects = Array.from(
    new Map(
      filteredRecords.map((r) => [
        r.session.class.subject.code,
        {
          code: r.session.class.subject.code,
          name: r.session.class.subject.name,
        },
      ]),
    ).values(),
  );

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
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Overall Attendance</p>
              <p className="mt-1 text-3xl font-bold" style={{ color: BAND_COLOR[overallBand] }}>
                {overallPercentage}%
              </p>
              <small className="text-xs text-muted-foreground">{BAND_MESSAGE[overallBand]}</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Total Classes</p>
              <p className="mt-1 text-3xl font-bold">{totalSessions}</p>
              <small className="text-xs text-muted-foreground">Conducted sessions</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Present</p>
              <p className="mt-1 text-3xl font-bold text-[var(--ctp-green)]">{presentSessions}</p>
              <small className="text-xs text-muted-foreground">Attended classes</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Absent</p>
              <p className="mt-1 text-3xl font-bold text-destructive">{absentSessions}</p>
              <small className="text-xs text-muted-foreground">Missed classes</small>
            </CardContent>
          </Card>
        </div>

        {/* Subject Breakdown Card */}
        {subjectStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subject-wise Attendance Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              {subjectStats.map((sub) => {
                const pct = sub.total > 0 ? (sub.present / sub.total) * 100 : 0;
                const band = attendanceBand(pct);
                return (
                  <div key={sub.code}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="min-w-0 text-sm">
                        <strong>{sub.code}</strong>{" "}
                        <span className="text-muted-foreground">— {sub.name}</span>
                      </span>
                      <span className="shrink-0 text-sm">
                        <strong style={{ color: BAND_COLOR[band] }}>
                          {pct.toFixed(1)}%
                        </strong>{" "}
                        <span className="text-xs text-muted-foreground">
                          ({sub.present}/{sub.total})
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: BAND_COLOR[band] }}
                      />
                    </div>
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

        {/* Colour legend: maps each subject's square colour to the subject. */}
        {legendSubjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-muted/20 px-4 py-3">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Subjects
            </span>
            {legendSubjects.map((subject) => (
              <span key={subject.code} className="inline-flex items-center gap-1.5 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-[4px]"
                  style={{ background: subjectColorByCode.get(subject.code) }}
                  aria-hidden="true"
                />
                <span className="font-mono font-semibold">{subject.code}</span>
                <span className="text-muted-foreground">{subject.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Daily Attendance Log — one row per date, subject chips inside.
            A chip's square carries the subject colour (see the legend) while
            the chip's border + background carry PRESENT (green) / ABSENT
            (neutral). */}
        {filteredRecords.length === 0 ? (
          <div className="rounded-md border bg-muted/40 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No attendance sessions recorded yet.</p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                        <div className="flex flex-wrap gap-1.5">
                          {dayRecords.map((item) => {
                            const present = item.status === "PRESENT";
                            const subject = item.session.class.subject;
                            return (
                              <span
                                key={item.id}
                                title={`${subject.name} — ${present ? "Present" : "Absent"}`}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
                                  present
                                    ? "border-[color-mix(in_oklab,var(--ctp-green)_45%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-[var(--ctp-green)]"
                                    : "border-border bg-muted/40 text-muted-foreground",
                                )}
                              >
                                <span
                                  className="size-2.5 shrink-0 rounded-[4px]"
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
