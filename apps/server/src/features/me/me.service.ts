import { ok, err, type Result } from "neverthrow";
import { xpForNextLevel, type MeResponse } from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError } from "../../utils/errors";
import type { MeRepository } from "./me.repository";
import type { StreaksService } from "../streaks/streaks.service";
import type { GamificationRepository } from "../gamification/gamification.repository";

export class MeService {
  constructor(
    private repo: MeRepository,
    private streaks: StreaksService,
    // gamification repo is here for the lives auto-refill helper, kept consistent
    // with the existing /users/me/lives logic.
    private gamification: GamificationRepository,
  ) {}

  async buildBundle(userId: string): Promise<Result<MeResponse, AppError>> {
    const profile = await this.repo.getProfile(userId);
    if (!profile) return err(new NotFoundError("User not found"));

    // Self-heal: if weekly_xp_reset_at is older than the most recent Monday
    // 00:00 BRT boundary, treat the snapshot as 0 and queue an out-of-band
    // reset. This protects against missed cron runs.
    const lastMondayBRT = computeLastMondayBoundary(new Date());
    const weeklyXp =
      !profile.weeklyXpResetAt || profile.weeklyXpResetAt < lastMondayBRT
        ? 0
        : profile.weeklyXp;
    if (weeklyXp === 0 && profile.weeklyXp > 0) {
      // fire-and-forget durable reset
      this.repo.resetWeeklyXpForUser(userId).catch(() => {
        // swallow — cron will catch up
      });
    }

    const streaksResult = await this.streaks.getStreaks(userId);
    if (streaksResult.isErr()) return err(streaksResult.error);
    const { currentStreak, longestStreak } = streaksResult.value;

    return ok({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      plan: profile.plan as "free" | "premium",
      totalXp: profile.totalXp,
      weeklyXp,
      currentLevel: profile.currentLevel,
      xpForNextLevel: xpForNextLevel(profile.totalXp),
      currentStreak,
      longestStreak,
      freezeTokens: profile.freezeTokens,
      lives: profile.lives,
      livesResetAt: profile.livesResetAt
        ? profile.livesResetAt.toISOString()
        : null,
      selectedExam: profile.selectedExam,
      dailyGoalMinutes: profile.dailyGoalMinutes,
      onboardingCompleted: profile.onboardingCompleted,
    });
  }
}

/**
 * Compute the most recent Monday 00:00 in America/Sao_Paulo, returned as a
 * Date in UTC. Used for the self-heal stale-check.
 */
function computeLastMondayBoundary(now: Date): Date {
  // BRT = UTC-3, no DST since 2019
  const brtOffsetMinutes = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const brtMs = utcMs - brtOffsetMinutes * 60 * 1000;
  const brt = new Date(brtMs);

  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const day = brt.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const mondayBrt = new Date(brt);
  mondayBrt.setUTCDate(brt.getUTCDate() - daysSinceMonday);
  mondayBrt.setUTCHours(0, 0, 0, 0);

  // Convert back to UTC by subtracting the offset
  return new Date(mondayBrt.getTime() + brtOffsetMinutes * 60 * 1000);
}
