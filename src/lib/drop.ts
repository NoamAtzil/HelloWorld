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

// ---------------------------------------------------------------------------
// The countdown to the next reset (midnight America/New_York).
//
// Only the NUMERIC parts of Intl are read (never its text), so every browser
// agrees. The reset is a real instant, so on a daylight-saving day (23 or 25
// hours long) the countdown is still exact.
// ---------------------------------------------------------------------------

type Zoned = { y: number; m: number; d: number; h: number; min: number; s: number };

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DROP_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** The wall-clock date and time of an instant in New York, as plain numbers. */
export function zonedParts(instant: Date): Zoned {
  const parts = zonedFormatter.formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: n("year"), m: n("month"), d: n("day"), h: n("hour") % 24, min: n("minute"), s: n("second") };
}

/** New York's offset from UTC at an instant, in ms (negative: behind UTC). */
export function nyOffsetMs(instant: Date): number {
  const z = zonedParts(instant);
  const asUtc = Date.UTC(z.y, z.m - 1, z.d, z.h, z.min, z.s);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant the Drop day ends: the next midnight in New York. */
export function nextDropReset(now: Date = new Date()): Date {
  const [y, m, d] = shiftDate(dropDate(now), 1).split("-").map(Number);
  const wallMidnightAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  let candidate = wallMidnightAsUtc - nyOffsetMs(new Date(wallMidnightAsUtc));
  // Re-check with the offset that applies AT the candidate (the day may have a DST shift).
  candidate = wallMidnightAsUtc - nyOffsetMs(new Date(candidate));
  return new Date(candidate);
}

/** "07:42:15" (hours can exceed 24 only if the clock is badly wrong). */
export function formatCountdown(ms: number): { h: number; m: number; s: number; text: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return { h, m, s, text: `${p(h)}:${p(m)}:${p(s)}` };
}

// localStorage keys for the once-a-day entrance and the once-per-winner reveal.
export const DROP_INTRO_KEY = "wss-drop-intro";
export const DROP_WINNER_KEY = "wss-drop-winner";
