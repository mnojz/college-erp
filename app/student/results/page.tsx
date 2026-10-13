"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconReport } from "@tabler/icons-react";

type MarkRow = {
  subject: { code: string; name: string; kind: "THEORY" | "PRACTICAL"; credits: number };
  maxMarks: number;
  marks: number;
  grade: string | null;
  gradePoint: number | null;
};

type Marksheet = {
  id: string;
  title: string;
  type: "END_SEMESTER" | "MID_TERM";
  semester: number;
  resultsPublishedAt: string;
  program: { name: string; code: string };
  rows: MarkRow[];
  gpa: number | null;
};

type Payload = {
  student: { name: string; program: { name: string; code: string } | null; semester: number | null };
  marksheet: Marksheet[];
  latestGpa: number | null;
};

const TYPE_LABEL: Record<string, string> = {
  END_SEMESTER: "End-Semester",
  MID_TERM: "Mid-Term",
};

export default function StudentResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/student/results");
        if (res.status === 401 || res.status === 403) {
          router.replace("/dashboard");
          return;
        }
        if (!res.ok) return;
        setData(await res.json());
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  return (
    <StudentShell title="My Results" subtitle="Published exam marksheets and GPA" active="/student/results">
      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : !data || data.marksheet.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <IconReport size={26} />
            </span>
            <div>
              <h3 className="text-base font-semibold">No results published yet</h3>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Your marksheets will appear here once your college publishes an exam result.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {data.marksheet.map((sheet) => (
            <Card key={sheet.id} className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                <div>
                  <CardTitle className="text-base">{sheet.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {sheet.program.name} · Semester {sheet.semester} · {TYPE_LABEL[sheet.type]}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tracking-tight">
                    {sheet.gpa !== null ? sheet.gpa.toFixed(2) : "—"}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">GPA</div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Marks</TableHead>
                        <TableHead className="text-center">Max</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-center">Grade Point</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.rows.map((row) => {
                        const passed = row.grade !== "F";
                        return (
                          <TableRow key={row.subject.code}>
                            <TableCell>
                              <strong>{row.subject.code}</strong>
                              <div className="text-xs text-muted-foreground">
                                {row.subject.name}
                                {row.subject.kind === "PRACTICAL" ? " · Practical" : ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{row.marks}</TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {row.maxMarks}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={passed ? "default" : "destructive"}>
                                {row.grade ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {row.gradePoint !== null ? row.gradePoint.toFixed(1) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </StudentShell>
  );
}