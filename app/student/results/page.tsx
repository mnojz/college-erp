"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/app/components/student/StudentShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconDownload, IconLoader2, IconReport } from "@tabler/icons-react";
import { MarkRow } from "@/app/lib/grading";
import { MarksheetPrint } from "@/app/components/student/MarksheetPrint";

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
  student: {
    name: string;
    registrationId: string | null;
    program: { name: string; code: string } | null;
    semester: number | null;
  };
  marksheet: Marksheet[];
  latestGpa: number | null;
};

const TYPE_LABEL: Record<string, string> = {
  END_SEMESTER: "End-Semester",
  MID_TERM: "Mid-Term",
};

/** Summary computed from all rows of a marksheet. */
function computeSummary(rows: MarkRow[]) {
  const totalCredits = rows.reduce((sum, r) => sum + r.credits, 0);
  const allPassed = rows.every((r) => r.passed);
  const earnedCredits = rows.filter((r) => r.passed).reduce((sum, r) => sum + r.credits, 0);
  const totalGradePoints = rows.filter((r) => r.passed).reduce((sum, r) => sum + r.gradePoint, 0);
  const gpa = earnedCredits > 0 ? totalGradePoints / earnedCredits : 0;
  return { totalCredits, earnedCredits, totalGradePoints, gpa, allPassed };
}

/** Download a single marksheet as a PDF via html2canvas + jsPDF. */
async function downloadMarksheet(
  ref: React.RefObject<HTMLDivElement | null>,
  filename: string,
  setLoading: (v: boolean) => void,
) {
  if (!ref.current) return;
  setLoading(true);
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(ref.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // If content fits on one page just add it; otherwise tile across pages.
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let yOffset = 0;
      while (yOffset < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -yOffset, imgWidth, imgHeight);
        yOffset += pageHeight;
        if (yOffset < imgHeight) pdf.addPage();
      }
    }

    pdf.save(`${filename}.pdf`);
  } catch (err) {
    console.error("PDF generation failed:", err);
  } finally {
    setLoading(false);
  }
}

/** Per-marksheet card with its own print ref and loading state. */
function MarksheetCard({
  sheet,
  studentName,
  registrationId,
}: {
  sheet: Marksheet;
  studentName: string;
  registrationId: string | null;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const summary = computeSummary(sheet.rows);
  const filename = `${studentName.replace(/\s+/g, "_")}_Sem${sheet.semester}_${sheet.type}`;

  return (
    <Card className="rounded-xl">
      {/* ── Card header (compact) ─────────────────────────────── */}
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-3.5 sm:px-4 pb-2.5">
        <div>
          <CardTitle className="text-sm font-semibold tracking-tight leading-none">{sheet.title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {sheet.program.name} · Semester {sheet.semester} · {TYPE_LABEL[sheet.type]}
          </p>
        </div>
        {/* GPA + single icon rounded square button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold tracking-tight leading-none">
              {summary.gpa > 0 ? summary.gpa.toFixed(2) : "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">GPA</div>
          </div>
          <Button
            variant="outline"
            size="icon"
            disabled={sheet.rows.length === 0}
            onClick={() => setPreviewOpen(true)}
            title="Preview and Download Marksheet"
            className="size-8.5 rounded-lg shrink-0 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <IconDownload className="size-4" />
            <span className="sr-only">Preview and download marksheet</span>
          </Button>
        </div>
      </CardHeader>

      {/* ── Marksheet table ─────────────────────────── */}
      <CardContent className="pt-0">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            {/* ── Two-row header ── */}
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b-0">
                <TableHead
                  rowSpan={2}
                  className="w-24 align-middle text-center text-xs font-bold uppercase tracking-wide"
                >
                  Course<br />
                  <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground">
                    Code
                  </span>
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="min-w-52 align-middle text-xs font-bold uppercase tracking-wide"
                >
                  Course Title
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="w-20 text-center align-middle text-xs font-bold uppercase tracking-wide"
                >
                  Credit<br />
                  <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground">
                    Hours
                  </span>
                </TableHead>
                <TableHead
                  colSpan={2}
                  className="text-center text-xs font-bold uppercase tracking-wide pb-1 border-b border-border/60"
                >
                  Obtained Grade
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="w-24 text-center align-middle text-xs font-bold uppercase tracking-wide"
                >
                  Final<br />
                  <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground">
                    Grade
                  </span>
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="w-24 text-center align-middle text-xs font-bold uppercase tracking-wide"
                >
                  Grade<br />
                  <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground">
                    Value
                  </span>
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="w-24 text-center align-middle text-xs font-bold uppercase tracking-wide"
                >
                  Grade<br />
                  <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground">
                    Point
                  </span>
                </TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="w-16 text-center text-xs font-semibold text-blue-700 dark:text-blue-400 pt-0 pb-2">
                  TH
                </TableHead>
                <TableHead className="w-16 text-center text-xs font-semibold text-violet-700 dark:text-violet-400 pt-0 pb-2">
                  PR
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {sheet.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No grades published for this session yet.
                  </TableCell>
                </TableRow>
              ) : (
                sheet.rows.map((row, idx) => (
                  <TableRow
                    key={`${row.subjectCode}-${row.kind}-${idx}`}
                    className={`hover:bg-muted/30 transition-colors ${
                      !row.passed && row.finalGrade !== "—" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <TableCell className="text-center font-mono text-xs font-semibold text-foreground">
                      {row.subjectCode}
                    </TableCell>
                    <TableCell className="text-sm">{row.subjectName}</TableCell>
                    <TableCell className="text-center tabular-nums text-sm font-medium">
                      {row.credits}
                    </TableCell>
                    {/* TH */}
                    <TableCell className="text-center">
                      {row.thGrade ? (
                        <span
                          className={`inline-block min-w-8 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                            row.thGrade === "F"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                        >
                          {row.thGrade}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    {/* PR */}
                    <TableCell className="text-center">
                      {row.prGrade ? (
                        <span
                          className={`inline-block min-w-8 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                            row.prGrade === "F"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                          }`}
                        >
                          {row.prGrade}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    {/* Final Grade */}
                    <TableCell className="text-center">
                      {row.finalGrade === "—" ? (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      ) : row.finalGrade === "F" ? (
                        <span className="inline-block min-w-8 rounded px-1.5 py-0.5 text-xs font-bold bg-destructive/15 text-destructive">
                          F
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-foreground">{row.finalGrade}</span>
                      )}
                    </TableCell>
                    {/* Grade Value */}
                    <TableCell className="text-center tabular-nums text-sm">
                      {row.finalGrade !== "—" ? (
                        row.gradeValue.toFixed(2)
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    {/* Grade Point */}
                    <TableCell className="text-center tabular-nums text-sm font-medium">
                      {row.finalGrade !== "—" ? (
                        row.gradePoint.toFixed(2)
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}

              {/* ── Summary rows ── */}
              {sheet.rows.length > 0 && (
                <>
                  <TableRow className="border-t-2 border-border bg-muted/30">
                    <TableCell colSpan={2} className="text-right text-sm font-bold text-foreground">
                      Total
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-sm font-bold text-foreground">
                      {summary.totalCredits}
                    </TableCell>
                    <TableCell /><TableCell /><TableCell />
                    <TableCell className="text-center tabular-nums text-sm text-muted-foreground">
                      {summary.allPassed ? summary.earnedCredits : "—"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-sm font-bold text-foreground">
                      {summary.allPassed ? summary.totalGradePoints.toFixed(2) : "—"}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={6} className="text-right text-xs text-muted-foreground">
                      GPA (Grade Point Average)
                    </TableCell>
                    <TableCell colSpan={2} className="text-center tabular-nums text-sm font-bold text-foreground">
                      {summary.gpa > 0 ? summary.gpa.toFixed(2) : "—"}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={6} className="text-right text-xs text-muted-foreground">
                      Result
                    </TableCell>
                    <TableCell
                      colSpan={2}
                      className={`text-center text-sm font-bold ${
                        summary.allPassed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {summary.allPassed ? "Pass" : "Fail"}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* ── Marksheet Preview Popup ────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
          showCloseButton={true}
        >
          <DialogHeader className="p-3.5 sm:px-6 border-b flex flex-row items-center justify-between gap-3 bg-muted/30">
            <div>
              <DialogTitle className="text-base font-semibold">Marksheet Preview</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sheet.title} · Semester {sheet.semester} · {studentName}
              </p>
            </div>
            <div className="flex items-center gap-2 pr-7">
              <Button
                size="sm"
                disabled={pdfLoading || sheet.rows.length === 0}
                onClick={() => downloadMarksheet(printRef, filename, setPdfLoading)}
                className="gap-1.5 text-xs h-8.5 font-medium"
              >
                {pdfLoading ? (
                  <IconLoader2 className="size-3.5 animate-spin" />
                ) : (
                  <IconDownload className="size-3.5" />
                )}
                {pdfLoading ? "Generating PDF…" : "Download Marksheet"}
              </Button>
            </div>
          </DialogHeader>

          {/* Scrollable preview body displaying the marksheet */}
          <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900/60 p-4 sm:p-6 flex justify-center items-start">
            <div className="overflow-x-auto max-w-full shadow-2xl rounded border border-slate-200/80 bg-white">
              <MarksheetPrint
                studentName={studentName}
                registrationId={registrationId}
                programName={sheet.program.name}
                semester={sheet.semester}
                rows={sheet.rows}
                summary={summary}
                printRef={printRef}
                isOffscreen={false}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

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
            <MarksheetCard
              key={sheet.id}
              sheet={sheet}
              studentName={data.student.name}
              registrationId={data.student.registrationId}
            />
          ))}
        </div>
      )}
    </StudentShell>
  );
}