/** Format a Date as YYYY-MM (UTC not used — server local time matches streak/session logic). */
export function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** True if the YYYY-MM string is strictly after the current month (server time). */
export function isFutureMonth(month: string): boolean {
  return month > formatMonth(new Date());
}

/**
 * Inclusive start (first-of-month) and exclusive end (first-of-next-month) as
 * YYYY-MM-DD strings. Used for SQL range queries against `date` columns:
 * `date >= start AND date < end`.
 *
 * Strings (not Date objects) are returned deliberately: the `daily_session.date`
 * column is a SQL `date` (no time, no timezone), and constructing a local-time
 * Date then coercing via `.toISOString().slice(0, 10)` shifts by a day on any
 * server running a UTC+X timezone (e.g., `Asia/Tokyo`).
 */
export function monthBoundaries(month: string): { start: string; end: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const endYear = monthIndex === 11 ? year + 1 : year;
  const endMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;

  const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const end = `${endYear}-${String(endMonthIndex + 1).padStart(2, "0")}-01`;
  return { start, end };
}
