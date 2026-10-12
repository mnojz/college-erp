import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AttendanceMeter,
  attendanceColor,
} from "@/app/components/teacher/AttendanceMeter";

describe("attendanceColor — continuous red→green gradient", () => {
  it("is pure red at 0%", () => {
    expect(attendanceColor(0)).toBe(
      "color-mix(in oklab, var(--ctp-green) 0%, var(--ctp-red) 100%)",
    );
  });

  it("is the exact midpoint of the blend at 50%", () => {
    expect(attendanceColor(50)).toBe(
      "color-mix(in oklab, var(--ctp-green) 50%, var(--ctp-red) 50%)",
    );
  });

  it("is pure green at 100%", () => {
    expect(attendanceColor(100)).toBe(
      "color-mix(in oklab, var(--ctp-green) 100%, var(--ctp-red) 0%)",
    );
  });

  it("clamps out-of-range rates to the endpoints", () => {
    expect(attendanceColor(-25)).toBe(attendanceColor(0));
    expect(attendanceColor(240)).toBe(attendanceColor(100));
  });
});

describe("AttendanceMeter — roster row markup", () => {
  it("lays out present/total → bar → percentage in reading order", () => {
    const html = renderToStaticMarkup(<AttendanceMeter present={14} total={16} />);
    const label = html.indexOf("14/16");
    const fill = html.indexOf("width:87.5%");
    const percent = html.indexOf("88%", fill);
    expect(label).toBeGreaterThan(-1);
    expect(fill).toBeGreaterThan(label);
    expect(percent).toBeGreaterThan(fill);
    // The bar carries the blended color for the same displayed rate.
    expect(html).toContain(
      "background:color-mix(in oklab, var(--ctp-green) 87.5%, var(--ctp-red) 12.5%)",
    );
  });

  it("shows a neutral empty state when no sessions have been held", () => {
    const html = renderToStaticMarkup(<AttendanceMeter present={0} total={0} />);
    expect(html).toContain("—/0");
    expect(html).toContain("width:0%");
    expect(html).toContain("background:transparent");
    // No green/red implied by a class that has never met.
    expect(html).not.toContain("ctp-green");
    expect(html).not.toContain("ctp-red");
    expect(html).toContain(">—<");
  });

  it("caps the bar at 100% even if the data is inconsistent", () => {
    const html = renderToStaticMarkup(<AttendanceMeter present={20} total={10} />);
    expect(html).toContain("width:100%");
    expect(html).toContain(
      "background:color-mix(in oklab, var(--ctp-green) 100%, var(--ctp-red) 0%)",
    );
  });

  it("rounds the percentage to an integer for column alignment", () => {
    const html = renderToStaticMarkup(<AttendanceMeter present={1} total={3} />);
    expect(html).toContain("33%");
    expect(html).not.toContain("33.3%");
  });
});
