const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfWeekBrt(now: Date): Date {
  const brtMs = now.getTime() - BRT_OFFSET_MS;
  const brt = new Date(brtMs);
  const dow = brt.getUTCDay(); // 0=Sun ... 6=Sat
  const daysBack = (dow + 6) % 7; // Monday-anchored
  brt.setUTCDate(brt.getUTCDate() - daysBack);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + BRT_OFFSET_MS);
}
