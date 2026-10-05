/**
 * The days the college teaches on.
 *
 * This is the ONE place that decides it. Previously the API accepted
 * SATURDAY/SUNDAY while the timetable grid and the admin day dropdowns were
 * Mon-Fri only — so a weekend class could be stored and then never rendered
 * anywhere, with no error. The API validator, the grid rows and the admin
 * dropdown all derive from this list so they cannot drift apart again.
 */
export const TEACHING_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const;

export type TeachingDay = (typeof TEACHING_DAYS)[number];

export function isTeachingDay(value: string): value is TeachingDay {
  return (TEACHING_DAYS as readonly string[]).includes(value);
}

/** Human label for error messages, e.g. "Saturday". */
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export function dayLabel(value: string): string {
  return DAY_LABELS[value] ?? value;
}
