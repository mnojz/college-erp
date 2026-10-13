/**
 * MarksheetPrint — hidden off-screen DOM element captured by html2canvas.
 * Uses inline styles exclusively (Tailwind classes are not applied at capture time).
 */
"use client";

import React from "react";
import { MarkRow } from "@/app/lib/grading";

interface MarksheetPrintProps {
  studentName: string;
  registrationId: string | null;
  programName: string;
  semester: number;
  rows: MarkRow[];
  summary: {
    totalCredits: number;
    earnedCredits: number;
    totalGradePoints: number;
    gpa: number;
    allPassed: boolean;
  };
  printRef: React.RefObject<HTMLDivElement | null>;
  isOffscreen?: boolean;
}

/* ── Shared cell styles ────────────────────────────────────────── */
const base: React.CSSProperties = {
  border: "1px solid #94a3b8",
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "Arial, 'Helvetica Neue', sans-serif",
  color: "#0f172a",
  verticalAlign: "middle",
};

const centerCell: React.CSSProperties = { ...base, textAlign: "center" };

const headerCell: React.CSSProperties = {
  ...centerCell,
  background: "#1e3a5f",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  padding: "8px 10px",
};

const subHeaderCell: React.CSSProperties = {
  ...headerCell,
  background: "#2c5282",
  fontSize: 10,
  padding: "5px 8px",
};

export function MarksheetPrint({
  studentName,
  registrationId,
  programName,
  semester,
  rows,
  summary,
  printRef,
  isOffscreen = false,
}: MarksheetPrintProps) {
  return (
    <div
      ref={printRef}
      style={
        isOffscreen
          ? {
              position: "absolute",
              left: "-9999px",
              top: 0,
              width: 820,
              background: "#ffffff",
              fontFamily: "Arial, 'Helvetica Neue', sans-serif",
              color: "#0f172a",
              padding: "36px 40px",
              boxSizing: "border-box",
            }
          : {
              position: "relative",
              width: 820,
              minWidth: 820,
              background: "#ffffff",
              fontFamily: "Arial, 'Helvetica Neue', sans-serif",
              color: "#0f172a",
              padding: "36px 40px",
              boxSizing: "border-box",
              margin: "0 auto",
            }
      }
    >
      {/* ── University Header ───────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          borderBottom: "3px solid #1e3a5f",
          paddingBottom: 20,
          marginBottom: 22,
          minHeight: 124,
        }}
      >
        {/* Logo — independent left aligned */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 4,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fwu-logo.png"
            alt="FWU Logo"
            width={116}
            height={116}
            style={{ objectFit: "contain", display: "block" }}
          />
        </div>

        {/* Title block — centered with respect to the entire page */}
        <div style={{ textAlign: "center", width: "100%" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#1e3a5f",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            Far Western University
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#2c5282",
              marginTop: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Faculty of Engineering
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#1e3a5f",
              marginTop: 3,
              letterSpacing: "0.03em",
            }}
          >
            Examination Operation and Management Unit
          </div>
          <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>
            Mahendranagar, Kanchanpur, Nepal
          </div>
          {/* "Academic Record" underline title */}
          <div
            style={{
              marginTop: 10,
              display: "inline-block",
              fontSize: 15,
              fontWeight: 800,
              color: "#0f172a",
              borderBottom: "2px solid #1e3a5f",
              paddingBottom: 3,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Academic Record
          </div>
        </div>
      </div>

      {/* ── Student Info Grid ───────────────────────────────────── */}
      <div
        style={{
          border: "1px solid #94a3b8",
          borderRadius: 6,
          padding: "14px 20px",
          marginBottom: 22,
          background: "#f8fafc",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "9px 40px",
          fontSize: 13,
          color: "#0f172a",
        }}
      >
        <div>
          <span style={{ fontWeight: 700, color: "#374151" }}>Name : </span>
          <span style={{ fontWeight: 800, textTransform: "uppercase" }}>{studentName}</span>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: "#374151" }}>Regd. No : </span>
          <span style={{ fontWeight: 700 }}>{registrationId ?? "—"}</span>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: "#374151" }}>Faculty : </span>
          <span>Engineering</span>
        </div>
        <div>
          <span style={{ fontWeight: 700, color: "#374151" }}>Semester : </span>
          <span>{semester}</span>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={{ fontWeight: 700, color: "#374151" }}>Program : </span>
          <span>{programName}</span>
        </div>
      </div>

      {/* ── Marksheet Table ─────────────────────────────────────── */}
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#0f172a" }}
      >
        <thead>
          {/* Row 1 — group labels */}
          <tr>
            <th rowSpan={2} style={{ ...headerCell, width: 76 }}>
              Course<br />Code
            </th>
            <th rowSpan={2} style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>
              Course Title
            </th>
            <th rowSpan={2} style={{ ...headerCell, width: 58 }}>
              Credit<br />Hours
            </th>
            <th
              colSpan={2}
              style={{ ...headerCell, borderBottom: "2px solid #4a6a9b" }}
            >
              Obtained Grade
            </th>
            <th rowSpan={2} style={{ ...headerCell, width: 66 }}>
              Final<br />Grade
            </th>
            <th rowSpan={2} style={{ ...headerCell, width: 66 }}>
              Grade<br />Value
            </th>
            <th rowSpan={2} style={{ ...headerCell, width: 72 }}>
              Grade<br />Point
            </th>
          </tr>
          {/* Row 2 — TH / PR */}
          <tr>
            <th style={{ ...subHeaderCell, width: 50 }}>TH</th>
            <th style={{ ...subHeaderCell, width: 50 }}>PR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const failed = !row.passed && row.finalGrade !== "—";
            return (
              <tr
                key={`${row.subjectCode}-${row.kind}-${idx}`}
                style={{
                  background: failed ? "#fff5f5" : idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                }}
              >
                <td style={{ ...centerCell, fontWeight: 700, fontFamily: "monospace, monospace" }}>
                  {row.subjectCode}
                </td>
                <td style={{ ...base, paddingLeft: 12 }}>{row.subjectName}</td>
                <td style={centerCell}>{row.credits}</td>
                {/* TH */}
                <td style={centerCell}>
                  {row.thGrade ? (
                    <span style={{ fontWeight: 700, color: row.thGrade === "F" ? "#b91c1c" : "#064e3b" }}>
                      {row.thGrade}
                    </span>
                  ) : ""}
                </td>
                {/* PR */}
                <td style={centerCell}>
                  {row.prGrade ? (
                    <span style={{ fontWeight: 700, color: row.prGrade === "F" ? "#b91c1c" : "#4c1d95" }}>
                      {row.prGrade}
                    </span>
                  ) : ""}
                </td>
                {/* Final Grade */}
                <td style={centerCell}>
                  {row.finalGrade === "—" ? "" : (
                    <span
                      style={{
                        fontWeight: 800,
                        color: row.finalGrade === "F" ? "#b91c1c" : "#0f172a",
                      }}
                    >
                      {row.finalGrade}
                    </span>
                  )}
                </td>
                {/* Grade Value */}
                <td style={centerCell}>
                  {row.finalGrade !== "—" ? row.gradeValue.toFixed(2) : ""}
                </td>
                {/* Grade Point */}
                <td style={{ ...centerCell, fontWeight: 700 }}>
                  {row.finalGrade !== "—" ? row.gradePoint.toFixed(2) : ""}
                </td>
              </tr>
            );
          })}

          {/* ── Summary rows ── */}
          <tr style={{ background: "#e2e8f0", borderTop: "2px solid #1e3a5f" }}>
            <td
              colSpan={2}
              style={{ ...base, textAlign: "right", fontWeight: 800, fontSize: 14 }}
            >
              Total
            </td>
            <td style={{ ...centerCell, fontWeight: 800, fontSize: 14 }}>{summary.totalCredits}</td>
            <td style={centerCell} /><td style={centerCell} /><td style={centerCell} />
            <td style={{ ...centerCell, color: "#374151" }}>
              {summary.allPassed ? summary.earnedCredits : "—"}
            </td>
            <td style={{ ...centerCell, fontWeight: 800 }}>
              {summary.allPassed ? summary.totalGradePoints.toFixed(2) : "—"}
            </td>
          </tr>

          <tr style={{ background: "#f1f5f9" }}>
            <td
              colSpan={6}
              style={{ ...base, textAlign: "right", fontSize: 12, color: "#374151", fontWeight: 600 }}
            >
              GPA (Grade Point Average)
            </td>
            <td
              colSpan={2}
              style={{ ...centerCell, fontWeight: 800, fontSize: 14 }}
            >
              {summary.gpa > 0 ? summary.gpa.toFixed(2) : "—"}
            </td>
          </tr>

          <tr style={{ background: "#f1f5f9" }}>
            <td
              colSpan={6}
              style={{ ...base, textAlign: "right", fontSize: 12, color: "#374151", fontWeight: 600 }}
            >
              Result
            </td>
            <td
              colSpan={2}
              style={{
                ...centerCell,
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: "0.06em",
                color: summary.allPassed ? "#15803d" : "#b91c1c",
              }}
            >
              {summary.allPassed ? "PASS" : "FAIL"}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── HOD Signature ───────────────────────────────────────── */}
      <div
        style={{
          marginTop: 48,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ textAlign: "center", minWidth: 160 }}>
          <div
            style={{
              borderTop: "1.5px solid #1e3a5f",
              paddingTop: 6,
              fontSize: 12,
              fontWeight: 700,
              color: "#1e3a5f",
              letterSpacing: "0.03em",
            }}
          >
            HOD Signature
          </div>
          <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>
            Head of Department
          </div>
        </div>
      </div>
    </div>
  );
}
