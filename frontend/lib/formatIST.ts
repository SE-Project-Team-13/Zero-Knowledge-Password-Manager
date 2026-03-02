/**
 * formatIST.ts
 * Utility helpers that format dates and timestamps in
 * India Standard Time (IST = UTC +05:30) for consistent
 * display across the web dashboard.
 */

const IST_LOCALE = "en-IN";
const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Format a Unix millisecond timestamp as IST time (HH:MM AM/PM).
 * Used for "Last synced at …" display.
 */
export function formatTimestampIST(ts: number | null): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleTimeString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format any ISO date string or Unix timestamp as a full IST
 * date-time string: "2 Mar 2026, 04:05 PM IST"
 */
export function formatDateTimeIST(value: string | number | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " IST";
}

/**
 * Format any ISO date string or Unix timestamp as a short IST
 * date: "2 Mar 2026"
 */
export function formatDateIST(value: string | number | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
