/**
 * Campus clock helpers.
 *
 * Class, break and attendance times are stored as WALL-CLOCK values: the
 * Prisma `Time` columns hold the literal digits (09:00) under a UTC epoch.
 * So "what day/time is it on campus" has to be answered in the campus
 * timezone, never the browser's — otherwise a teacher whose machine is set
 * to another zone gets the wrong day, the wrong "current" class, and (near
 * midnight) attendance recorded against the wrong date.
 */
export const CAMPUS_TIME_ZONE = "Asia/Kathmandu";

const WEEKDAY_TO_DAY_OF_WEEK: Record<string, string> = {
  Sun: "SUNDAY",
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: "SATURDAY",
};

/** Campus wall-clock DayOfWeek enum value (e.g. "MONDAY"). */
export function campusDayOfWeek(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "short",
  }).formatToParts(at);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  return WEEKDAY_TO_DAY_OF_WEEK[weekday] ?? "MONDAY";
}

/** Campus wall-clock minutes since midnight. */
export function campusMinutesOfDay(at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Some engines render midnight as "24" when hour12 is false.
  return (get("hour") % 24) * 60 + get("minute");
}

/** Today's date on campus as YYYY-MM-DD (the attendance sessionDate format). */
export function campusTodayISO(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Campus wall-clock day + minutes in one call. */
export function campusNow(at: Date = new Date()): { day: string; minutes: number } {
  return { day: campusDayOfWeek(at), minutes: campusMinutesOfDay(at) };
}
