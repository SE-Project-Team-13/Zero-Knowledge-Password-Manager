/**
 * formatIST.ts
 * Utility helpers that format dates and timestamps in
 * India Standard Time (IST = UTC +05:30) for consistent
 * display across the mobile app.
 *
 * React Native's Intl support covers modern Android/iOS,
 * and Expo includes the full Hermes runtime with Intl.
 */

const IST_LOCALE = "en-IN";
const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Format a Unix millisecond timestamp as IST time string: "04:05 PM IST"
 * Used for "Last synced at …" / "Last updated …" displays.
 */
export function formatTimestampIST(ts: number | null | undefined): string {
  if (!ts) return "Never";
  try {
    const time = new Date(ts).toLocaleTimeString(IST_LOCALE, {
      timeZone: IST_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${time} IST`;
  } catch {
    return new Date(ts).toISOString();
  }
}

/**
 * Format any ISO date string or Unix timestamp as a full IST
 * date-time: "2 Mar 2026, 04:05 PM IST"
 */
export function formatDateTimeIST(value: string | number | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value as string);
  if (isNaN(date.getTime())) return String(value);
  try {
    const formatted = date.toLocaleString(IST_LOCALE, {
      timeZone: IST_TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${formatted} IST`;
  } catch {
    return date.toISOString();
  }
}

/**
 * Format any ISO date string or Unix timestamp as a short IST
 * date: "2 Mar 2026"
 */
export function formatDateIST(value: string | number | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value as string);
  if (isNaN(date.getTime())) return String(value);
  try {
    return date.toLocaleDateString(IST_LOCALE, {
      timeZone: IST_TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date.toISOString().split("T")[0];
  }
}
