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

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "table"; table: TableParsed };

export type ParsedNotice = {
  leadText: string;
  table: TableParsed | null;
  trailingText: string;
  blocks: ContentBlock[];
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

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(trimmed) ||
    /^\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\s*$/.test(trimmed)
  );
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function parseRowCells(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

/**
 * Robust notice parser: extracts all markdown tables and legacy routine lists
 * sequentially into structured content blocks so table rows never spill into raw text.
 */
export function parseNoticeBody(body: string): ParsedNotice {
  if (!body) return { leadText: "", table: null, trailingText: "", blocks: [] };

  const lines = body.split("\n");
  const blocks: ContentBlock[] = [];
  let currentTextLines: string[] = [];

  function flushText() {
    const text = currentTextLines.join("\n").trim();
    if (text) {
      blocks.push({ type: "text", text });
    }
    currentTextLines = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check if line starts a markdown table (starts with pipe and has a separator row or row next)
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      (isTableSeparator(lines[i + 1]) || isTableRow(lines[i + 1]))
    ) {
      flushText();

      const tableLines: string[] = [line];
      i++;
      let hasSeparator = false;
      if (i < lines.length && isTableSeparator(lines[i])) {
        hasSeparator = true;
        i++;
      }

      while (i < lines.length) {
        const curLine = lines[i];
        if (isTableSeparator(curLine)) {
          i++;
          continue;
        }
        if (isTableRow(curLine)) {
          tableLines.push(curLine);
          i++;
        } else {
          break;
        }
      }

      const headers = parseRowCells(tableLines[0]);
      const dataLines = tableLines.slice(1);
      const rows = dataLines
        .map((l) => parseRowCells(l))
        .filter((cells) => cells.some((c) => c !== ""));

      if (headers.length > 0 && (rows.length > 0 || hasSeparator)) {
        const isRoutine =
          headers.some((h) => /day|date/i.test(h)) &&
          headers.some((h) => /subject|course|paper/i.test(h));

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

        blocks.push({
          type: "table",
          table: {
            isRoutine,
            headers,
            rows,
            routineEntries,
          },
        });
      } else {
        currentTextLines.push(...tableLines);
      }
      continue;
    }

    // Check if line starts a legacy routine list
    if (LEGACY_ROUTINE_REGEX.test(line)) {
      flushText();

      const routineLines: string[] = [];
      while (
        i < lines.length &&
        (LEGACY_ROUTINE_REGEX.test(lines[i]) || (routineLines.length > 0 && lines[i].trim() === ""))
      ) {
        if (lines[i].trim() !== "") {
          routineLines.push(lines[i]);
        }
        i++;
      }

      const routineEntries: RoutineEntryParsed[] = [];
      for (const rl of routineLines) {
        const match = rl.match(LEGACY_ROUTINE_REGEX);
        if (match) {
          const day = match[2] || deriveWeekday(match[3]);
          const date = match[3];
          const { code, name } = parseSubjectString(match[4]);
          routineEntries.push({ day, date, code, name });
        }
      }

      if (routineEntries.length > 0) {
        const headers = ["Day", "Date", "Subject"];
        const rows = routineEntries.map((e) => [
          e.day,
          e.date,
          e.name ? `${e.code} — ${e.name}` : e.code,
        ]);
        blocks.push({
          type: "table",
          table: {
            isRoutine: true,
            headers,
            rows,
            routineEntries,
          },
        });
      }
      continue;
    }

    currentTextLines.push(line);
    i++;
  }

  flushText();

  const firstTableBlock = blocks.find((b): b is { type: "table"; table: TableParsed } => b.type === "table");
  const firstTextBlock = blocks.find((b): b is { type: "text"; text: string } => b.type === "text");

  return {
    leadText: firstTextBlock?.text ?? "",
    table: firstTableBlock?.table ?? null,
    trailingText: "",
    blocks,
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
      {parsed.blocks.length === 0 && (
        <div className="text-[15px] leading-relaxed whitespace-pre-line">
          {body}
        </div>
      )}

      {parsed.blocks.map((block, idx) => {
        if (block.type === "text") {
          return (
            <div key={idx} className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">
              {block.text}
            </div>
          );
        }

        const table = block.table;
        return (
          <div key={idx} className="flex flex-col gap-2 my-1">
            {table.isRoutine ? (
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
                  {table.routineEntries && (
                    <Badge className="text-[10px] font-mono border-0 bg-primary/15 text-primary">
                      {table.routineEntries.length} Paper{table.routineEntries.length === 1 ? "" : "s"}
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
                    {table.routineEntries?.map((row, rIdx) => (
                      <TableRow key={rIdx} className="hover:bg-muted/30">
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
                      {table.headers.map((h, hIdx) => (
                        <TableHead
                          key={hIdx}
                          className={cn(
                            "bg-muted/20 text-xs font-semibold text-foreground",
                            hIdx < table.headers.length - 1 && "border-r"
                          )}
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.rows.map((row, rIdx) => (
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
        );
      })}
    </div>
  );
}
