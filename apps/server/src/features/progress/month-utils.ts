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
 * Inclusive start (first-of-month, local midnight) and exclusive end (first-of-next-month).
 * Used for SQL range queries: `date >= start AND date < end`.
 */
export function monthBoundaries(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start, end };
}
