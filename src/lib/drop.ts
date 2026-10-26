import type { LibraryItem } from "./library";

// The Daily Drop runs on one clock: America/New_York. The database uses the
// same zone (public.drop_today()), so "today" is the same everywhere.
export const DROP_TIMEZONE = "America/New_York";

// "YYYY-MM-DD" for the given instant in the Drop's time zone.
export function dropDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DROP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

// Whole days since 1970-01-01 for a "YYYY-MM-DD" date.
export function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

// The challenge image for a date: an admin override if it names a real
// library image, otherwise a deterministic pick (same date -> same image).
export function pickChallenge(
  date: string,
  library: LibraryItem[],
  overrideSlug?: string | null,
): LibraryItem | null {
  if (library.length === 0) return null;
  const sorted = [...library].sort((a, b) => a.file.localeCompare(b.file));
  const override = overrideSlug ? sorted.find((item) => item.file === overrideSlug) : undefined;
  return override ?? sorted[((dayNumber(date) % sorted.length) + sorted.length) % sorted.length];
}

export function formatDropDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
