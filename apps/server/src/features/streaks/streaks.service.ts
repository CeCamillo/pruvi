import { ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import type { StreaksRepository } from "./streaks.repository";

export class StreaksService {
  constructor(private repo: StreaksRepository) {}

  async getStreaks(
    userId: string
  ): Promise<
    Result<
      { currentStreak: number; longestStreak: number; totalSessions: number },
      AppError
    >
  > {
    const [dates, totalSessions] = await Promise.all([
      this.repo.getCompletedSessionDates(userId),
      this.repo.countCompletedSessions(userId),
    ]);

    if (dates.length === 0) {
      return ok({ currentStreak: 0, longestStreak: 0, totalSessions: 0 });
    }

    const { currentStreak, longestStreak } = computeStreaks(dates);

    return ok({ currentStreak, longestStreak, totalSessions });
  }
}

/**
 * Compute current and longest streaks from an array of date strings
 * sorted newest-first (e.g., ["2026-03-15", "2026-03-14", "2026-03-12"]).
 */
function computeStreaks(dates: string[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // Check if today or yesterday is in the dates (to count current streak)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of dates) {
    const date = new Date(dateStr + "T00:00:00");

    if (prevDate === null) {
      // First date — start counting if it's today or yesterday
      if (dateStr === todayStr || dateStr === yesterdayStr) {
        streak = 1;
      } else {
        // Streak is broken — first completed day is older than yesterday
        streak = 1;
        longestStreak = Math.max(longestStreak, streak);
        // Reset for counting historical streaks
      }
    } else {
      const diff =
        (prevDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

      if (Math.round(diff) === 1) {
        // Consecutive day
        streak += 1;
      } else {
        // Gap — streak broken
        if (currentStreak === 0 && (dates[0] === todayStr || dates[0] === yesterdayStr)) {
          currentStreak = streak;
        }
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }

    prevDate = date;
  }

  // Finalize
  longestStreak = Math.max(longestStreak, streak);
  if (currentStreak === 0 && (dates[0] === todayStr || dates[0] === yesterdayStr)) {
    currentStreak = streak;
  }

  return { currentStreak, longestStreak };
}
