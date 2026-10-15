"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  IconCalendarEvent,
  IconChecklist,
  IconTable,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type RoutineEntryParsed = {
  day: string;
  date: string;
  code: string;
  name: string;
};

export type TableParsed = {
  isRoutine: boolean;
  headers: string[];
  rows: string[][];
  routineEntries?: RoutineEntryParsed[];
};

export type ParsedNotice = {
  leadText: string;
  table: TableParsed | null;
  trailingText: string;
};

const LEGACY_ROUTINE_REGEX =
  /^\s*(\d+)[\.\)]\s*(?:([A-Za-z]{3}),?\s+)?(\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{4})?|\d{4}-\d{2}-\d{2})[:\s]+(.+)$/;

function parseSubjectString(raw: string): { code: string; name: string } {
  const trimmed = raw.trim();
  const sepMatch = trimmed.match(/^([A-Za-z0-9\-_/]+)\s*(?:—|-|:)\s*(.+)$/);
  if (sepMatch) {
    return { code: sepMatch[1].trim(), name: sepMatch[2].trim() };
  }
  return { code: trimmed, name: "" };
}

function deriveWeekday(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    }
  } catch {
    // Ignored
  }
  return "—";
}

/**
 * Robust notice parser: extracts markdown tables or legacy routine lists
 * from any announcement body.
 */
export function parseNoticeBody(body: string): ParsedNotice {
  if (!body) return { leadText: "", table: null, trailingText: "" };

  const lines = body.split("\n");

  // 1. Try to find a Markdown Table
  const tableStartIdx = lines.findIndex((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
  if (tableStartIdx !== -1) {
    let tableEndIdx = tableStartIdx;
    while (
      tableEndIdx < lines.length &&
      lines[tableEndIdx].trim().startsWith("|") &&
      lines[tableEndIdx].trim().endsWith("|")
    ) {
      tableEndIdx++;
    }

    const tableLines = lines.slice(tableStartIdx, tableEndIdx);
    if (tableLines.length >= 2) {
      const headerLine = tableLines[0];
      const headers = headerLine
        .split("|")
        .slice(1, -1)
        .map((h) => h.trim());

      const dataLines = tableLines
        .slice(1)
        .filter((l) => !/^\|(\s*:?-+:?\s*\|)+$/.test(l.trim()));

      const rows = dataLines.map((l) =>
        l
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim())
      );

      if (headers.length > 0 && rows.length > 0) {
        const lead = lines.slice(0, tableStartIdx).join("\n").trim();
        const trailing = lines.slice(tableEndIdx).join("\n").trim();

        const isRoutine =
          headers.some((h) => /day|date/i.test(h)) && headers.some((h) => /subject|course|paper/i.test(h));

        let routineEntries: RoutineEntryParsed[] | undefined;
        if (isRoutine) {
          const dayIdx = headers.findIndex((h) => /day/i.test(h));
          const dateIdx = headers.findIndex((h) => /date/i.test(h));
          const subIdx = headers.findIndex((h) => /subject|course|paper/i.test(h));

          routineEntries = rows.map((r) => {
            const dateVal = dateIdx !== -1 ? r[dateIdx] ?? "" : "";
            const dayVal = dayIdx !== -1 && r[dayIdx] ? r[dayIdx] : deriveWeekday(dateVal);
            const subRaw = subIdx !== -1 ? r[subIdx] ?? "" : "";
            const { code, name } = parseSubjectString(subRaw);
            return { day: dayVal, date: dateVal, code, name };
          });
        }

        return {
          leadText: lead,
          table: {
            isRoutine,
            headers,
            rows,
            routineEntries,
          },
          trailingText: trailing,
        };
      }
    }
  }

  // 2. Try to find legacy numbered routine list
  const routineStartIdx = lines.findIndex((l) => LEGACY_ROUTINE_REGEX.test(l));
  if (routineStartIdx !== -1) {
    let routineEndIdx = routineStartIdx;
    while (
      routineEndIdx < lines.length &&
      (LEGACY_ROUTINE_REGEX.test(lines[routineEndIdx]) || lines[routineEndIdx].trim() === "")
    ) {
      routineEndIdx++;
    }

    const routineLines = lines.slice(routineStartIdx, routineEndIdx).filter((l) => l.trim() !== "");
    const routineEntries: RoutineEntryParsed[] = [];

    for (const l of routineLines) {
      const match = l.match(LEGACY_ROUTINE_REGEX);
      if (match) {
        const day = match[2] || deriveWeekday(match[3]);
        const date = match[3];
        const { code, name } = parseSubjectString(match[4]);
        routineEntries.push({ day, date, code, name });
      }
    }

    if (routineEntries.length > 0) {
      let lead = lines.slice(0, routineStartIdx).join("\n").trim();
      lead = lead.replace(/(?:^|\n)\s*Exam Routine:?\s*$/i, "").trim();
      const trailing = lines.slice(routineEndIdx).join("\n").trim();

      const headers = ["Day", "Date", "Subject"];
      const rows = routineEntries.map((e) => [
        e.day,
        e.date,
        e.name ? `${e.code} — ${e.name}` : e.code,
      ]);

      return {
        leadText: lead,
        table: {
          isRoutine: true,
          headers,
          rows,
          routineEntries,
        },
        trailingText: trailing,
      };
    }
  }

  // Plain text fallback
  return {
    leadText: body.trim(),
    table: null,
    trailingText: "",
  };
}

export function NoticeContentRenderer({
  body,
  mode = "full",
  compact = false,
}: {
  body: string;
  mode?: "full" | "preview";
  compact?: boolean;
}) {
  const parsed = useMemo(() => parseNoticeBody(body), [body]);

  if (mode === "preview") {
    const textPreview =
      parsed.leadText?.replace(/###\s*/g, "").replace(/\*\*/g, "").trim() ||
      (parsed.table?.isRoutine
        ? "Official examination routine announced. Click to view schedule."
        : parsed.table
        ? "Structured table data included. Click to view full details."
        : "");

    return (
      <div className="flex flex-col gap-2">
        {textPreview && (
          <p
            className={cn(
              "text-xs text-muted-foreground leading-relaxed line-clamp-3",
              compact && "line-clamp-2"
            )}
          >
            {textPreview}
          </p>
        )}
      </div>
    );
  }

  // Full Mode (used inside NoticeDetailModal)
  return (
    <div className="flex flex-col gap-4 text-foreground/90">
      {/* Lead Text */}
      {parsed.leadText && (
        <div className="text-[15px] leading-relaxed whitespace-pre-line">
          {parsed.leadText}
        </div>
      )}

      {/* Routine / Table Section */}
      {parsed.table && (
        <div className="flex flex-col gap-2 my-1">
          {parsed.table.isRoutine ? (
            <div className="overflow-hidden rounded-xl border border-border/80 shadow-xs bg-card">
              {/* Routine Header Bar */}
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconCalendarEvent size={15} />
                  </div>
                  <span className="text-xs font-bold tracking-tight text-foreground uppercase">
                    Official Exam Routine
                  </span>
                </div>
                {parsed.table.routineEntries && (
                  <Badge variant="outline" className="text-[10px] font-mono bg-background">
                    {parsed.table.routineEntries.length} Paper{parsed.table.routineEntries.length === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-20 border-r bg-muted/20 text-xs font-semibold text-foreground">
                      Day
                    </TableHead>
                    <TableHead className="w-32 border-r bg-muted/20 text-xs font-semibold text-foreground">
                      Date
                    </TableHead>
                    <TableHead className="bg-muted/20 text-xs font-semibold text-foreground">
                      Subject / Paper
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.table.routineEntries?.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="border-r whitespace-nowrap text-xs font-medium text-muted-foreground">
                        {row.day}
                      </TableCell>
                      <TableCell className="border-r whitespace-nowrap text-xs font-medium text-foreground">
                        {row.date}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">{row.code}</span>
                          {row.name && (
                            <span className="text-xs text-muted-foreground">{row.name}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* General Structured Table */
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {parsed.table.headers.map((h, i) => (
                      <TableHead
                        key={i}
                        className={cn(
                          "bg-muted/20 text-xs font-semibold text-foreground",
                          i < parsed.table!.headers.length - 1 && "border-r"
                        )}
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.table.rows.map((row, rIdx) => (
                    <TableRow key={rIdx} className="hover:bg-muted/30">
                      {row.map((cell, cIdx) => (
                        <TableCell
                          key={cIdx}
                          className={cn(
                            "text-xs text-foreground",
                            cIdx < row.length - 1 && "border-r"
                          )}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Trailing Text */}
      {parsed.trailingText && (
        <div className="text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">
          {parsed.trailingText}
        </div>
      )}
    </div>
  );
}

