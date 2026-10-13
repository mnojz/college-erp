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
import { GRADE_VALUE, buildRowForSubject, MarkRow } from "@/app/lib/grading";

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

/** Build a marksheet row for the Th/PR table.
 *
 * A subject with both a TH and PR paper contributes its full credit into the
 * theory cell (1 for the practical part) and 1 for the practical cell; the two
 * cells sit side by side in one row. A single-part subject gets everything in
 * its part column with 0 in the other.
 */

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
                        <TableHead>Subject Code</TableHead>
                        <TableHead className="text-center">Subject Name</TableHead>
                        <TableHead className="text-center">Credit Hours</TableHead>
                        <TableHead className="text-center">Obtained Grades</TableHead>
                        <TableHead className="text-center">Final Grade</TableHead>
                        <TableHead className="text-center">Grade Value</TableHead>
                        <TableHead className="text-center">Grade Point</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.rows.map((row) => (
                        <TableRow key={row.subjectName}>
                          <TableCell>{row.subjectName}</TableCell>
                          <TableCell className="text-center">
                            {row.subjectName}
                            {row.thGrade || row.prGrade ? (
                              <div className="mt-0.5">
                                <div className="text-xs text-muted-foreground">
                                  {row.thGrade ? "TH" : "PR"}
                                  {row.thGrade || row.prGrade ? " \u25C6 " : ""}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {row.thGrade ? `TH: ${row.thGrade}` : ""}
                                  {row.thGrade && row.prGrade ? " \u2022 " : ""}
                                  {row.prGrade ? `PR: ${row.prGrade}` : ""}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">No grade published</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.thGrade ? (
                              <>
                                <span>{row.totalCredits - 1}</span>
                                <span className="text-xs text-muted-foreground"> (TH)</span>
                                <span className="mx-1">/</span>
                                <span>1</span>
                                <span className="text-xs text-muted-foreground"> (PR)</span>
                              </>
                            ) : (
                              <>{row.totalCredits}</>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-4">
                              <div className="flex flex-col items-center">
                                {row.thGrade ? (
                                  <Badge variant={row.passed ? "default" : "destructive"}>
                                    {row.thGrade}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </div>
                              <div className="flex flex-col items-center">
                                {row.prGrade ? (
                                  <Badge variant={row.passed ? "default" : "destructive"}>
                                    {row.prGrade}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {row.finalGrade === "F" ? (
                              <Badge variant="destructive">F</Badge>
                            ) : row.finalGrade ? (
                              <Badge variant="default">{row.finalGrade}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.gradeValue !== null ? row.gradeValue.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {row.creditPoints !== null ? row.creditPoints.toFixed(1) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex justify-end gap-6 border-t pt-4 text-sm">
                  <div className="text-right">
                    <div className="font-semibold">Total</div>
                    <div className="text-muted-foreground">Credits: {sheet.rows.reduce((acc, r) => acc + r.totalCredits, 0)}</div>
                    <div className="text-muted-foreground">
                      Grade points: {sheet.rows.reduce((acc, r) => acc + r.creditPoints, 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">Result</div>
                    <div className={`font-bold ${sheet.rows.every((r) => r.passed) ? "text-green-600" : "text-destructive"}`}>
                      {sheet.rows.every((r) => r.passed) ? "PASSED" : "FAILED"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </StudentShell>
  );
}