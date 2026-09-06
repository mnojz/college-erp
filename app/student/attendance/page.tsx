"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Badge } from "@/components/ui/badge";
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
  rollNumber: string | null;
  profileImageUrl: string | null;
  user: { email: string; firstName: string; lastName: string };
  program: { name: string; code: string } | null;
};

type AttendanceRecord = {
  status: "PRESENT" | "ABSENT";
  session: {
    sessionDate: string;
    class: {
      subject: { code: string; name: string };
      semester?: number;
    };
  };
};

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
  const studentId = profile.rollNumber || profile.enrollmentNumber;

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

  const eligible = Number(overallPercentage) >= 75;

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
              <p className={cn("mt-1 text-3xl font-bold", eligible ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                {overallPercentage}%
              </p>
              <small className="text-xs text-muted-foreground">
                {eligible ? "Eligible for examinations" : "Below 75% threshold"}
              </small>
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
              <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{presentSessions}</p>
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
                const isSafe = pct >= 75;
                return (
                  <div key={sub.code}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="min-w-0 text-sm">
                        <strong>{sub.code}</strong>{" "}
                        <span className="text-muted-foreground">— {sub.name}</span>
                      </span>
                      <span className="shrink-0 text-sm">
                        <strong className={isSafe ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                          {pct.toFixed(1)}%
                        </strong>{" "}
                        <span className="text-xs text-muted-foreground">
                          ({sub.present}/{sub.total})
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", isSafe ? "bg-emerald-500" : "bg-destructive")}
                        style={{ width: `${pct}%` }}
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

        {/* Daily Attendance Log Table */}
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
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((item, idx) => {
                    const isPresent = item.status === "PRESENT";
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {new Date(item.session.sessionDate).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <strong>{item.session.class.subject.code}</strong>
                          <div className="text-xs text-muted-foreground">{item.session.class.subject.name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.session.class.semester ? `Sem ${item.session.class.semester}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPresent ? "default" : "destructive"}>
                            {isPresent ? "PRESENT" : "ABSENT"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </StudentShell>
  );
}
