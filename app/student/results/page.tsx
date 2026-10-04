"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Profile = {
  enrollmentNumber: string;
  registrationId: string;
  rollNumber: string | null;
  profileImageUrl: string | null;
  user: { email: string; firstName: string; lastName: string };
  program: { name: string; code: string } | null;
};

type ResultRecord = {
  id: string;
  marks: number | string;
  grade: string | null;
  assessment: {
    id: string;
    name: string;
    semester: number;
    maxMarks: number | string;
    assessmentDate: string | null;
    subject: { code: string; name: string };
    program: { name: string };
  };
};

type Pagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
};

type SubjectOption = { code: string; name: string };

type Summary = { totalAssessments: number; averagePercentage: number };

export default function StudentResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSubject, setFilterSubject] = useState("ALL");
  const [filterSemester, setFilterSemester] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadData() {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (filterSubject !== "ALL") params.set("subject", filterSubject);
        if (filterSemester !== "ALL") params.set("semester", filterSemester);

        const [profileRes, resultsRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch(`/api/student/results?${params.toString()}`),
        ]);

        if (!profileRes.ok) {
          router.replace("/dashboard");
          return;
        }
        if (!resultsRes.ok) {
          setError("Unable to load results from server");
          return;
        }

        const profileData = await profileRes.json();
        const resultsData = await resultsRes.json();

        setProfile(profileData.student);
        setResults(resultsData.results ?? []);
        setSubjects(resultsData.subjects ?? []);
        setSummary(resultsData.summary ?? null);
        setPagination(resultsData.pagination ?? null);
      } catch {
        setError("Unable to load results from server");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, page, filterSubject, filterSemester]);

  if (error) {
    return (
      <StudentShell title="Examination & Assessment Results" active="/student/results">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      </StudentShell>
    );
  }
  if (loading || !profile) {
    return (
      <StudentShell title="Examination & Assessment Results" active="/student/results">
        <Skeleton className="h-40 w-full" />
      </StudentShell>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const studentId = profile.rollNumber || profile.enrollmentNumber;

  const subjectOptions: SubjectOption[] =
    subjects.length > 0
      ? subjects
      : Array.from(
          new Map(
            results.map((r) => [
              r.assessment.subject.code,
              { code: r.assessment.subject.code, name: r.assessment.subject.name },
            ]),
          ).values(),
        ).sort((a, b) => a.code.localeCompare(b.code));

  const pageResults = results;

  const totalAssessments = summary?.totalAssessments ?? pagination?.total ?? results.length;
  const avgPercentage =
    summary?.averagePercentage ??
    (pageResults.length > 0
      ? Number(
          (
            pageResults.reduce(
              (acc, curr) => acc + (Number(curr.marks) / Number(curr.assessment.maxMarks)) * 100,
              0
            ) / pageResults.length
          ).toFixed(1),
        )
      : 0);

  return (
    <StudentShell
      active="/student/results"
      name={fullName}
      studentId={studentId}
      avatarUrl={profile.profileImageUrl}
      title="Examination & Assessment Results"
      subtitle="Academic Performance"
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Assessments Taken</p>
              <p className="mt-1 text-3xl font-bold">{totalAssessments}</p>
              <small className="text-xs text-muted-foreground">Recorded tests &amp; exams</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Average Score</p>
              <p className="mt-1 text-3xl font-bold">{avgPercentage}%</p>
              <small className="text-xs text-muted-foreground">Across all subjects</small>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Program</p>
              <p className="mt-1 truncate text-xl font-bold">{profile.program?.code ?? "N/A"}</p>
              <small className="line-clamp-1 text-xs text-muted-foreground">
                {profile.program?.name ?? "Enrolled Program"}
              </small>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {subjectOptions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by Subject:</span>
              <Select value={filterSubject} onValueChange={(value) => { setFilterSubject(value); setPage(1); }}>
                <SelectTrigger className="min-w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Subjects</SelectItem>
                  {subjectOptions.map((sub) => (
                    <SelectItem key={sub.code} value={sub.code}>
                      {sub.code} — {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Semester:</span>
            <Select value={filterSemester} onValueChange={(value) => { setFilterSemester(value); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Semesters</SelectItem>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <SelectItem key={sem} value={String(sem)}>
                    Semester {sem}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {pageResults.length === 0 ? (
          <div className="rounded-md border bg-muted/40 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {totalAssessments > 0
                ? "No results match the selected filters."
                : "No published assessment results found yet."}
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Marks Obtained</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageResults.map((item) => {
                    const marks = Number(item.marks);
                    const maxMarks = Number(item.assessment.maxMarks);
                    const pct = maxMarks > 0 ? ((marks / maxMarks) * 100).toFixed(1) : "0";
                    const isPassing = marks >= maxMarks * 0.4;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <strong>{item.assessment.subject.code}</strong>
                          <div className="text-xs text-muted-foreground">{item.assessment.subject.name}</div>
                        </TableCell>
                        <TableCell className="font-medium">{item.assessment.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.assessment.assessmentDate
                            ? new Date(item.assessment.assessmentDate).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {marks} / {maxMarks}
                        </TableCell>
                        <TableCell>
                          <span className={isPassing ? "font-semibold text-[var(--ctp-green)]" : "font-semibold text-destructive"}>
                            {pct}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPassing ? "default" : "destructive"}>
                            {item.grade || (isPassing ? "PASS" : "FAIL")}
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

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Showing {pageResults.length} of {pagination.total} results
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
