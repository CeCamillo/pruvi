import { ok, err, type Result } from "neverthrow";
import { planSchema, xpForNextLevel, type MeResponse } from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { MeRepository } from "./me.repository";
import type { StreaksService } from "../streaks/streaks.service";
import type { LivesService } from "../lives/lives.service";

export class MeService {
  constructor(
    private repo: MeRepository,
    private streaks: StreaksService,
    private lives: LivesService,
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

    const livesResult = await this.lives.getLives(userId);
    if (livesResult.isErr()) return err(livesResult.error);
    const livesSnapshot = livesResult.value;

    const planResult = planSchema.safeParse(profile.plan);
    if (!planResult.success) {
      return err(new ValidationError(`Invalid plan value: ${profile.plan}`));
    }

    return ok({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      plan: planResult.data,
      totalXp: profile.totalXp,
      weeklyXp,
      currentLevel: profile.currentLevel,
      xpForNextLevel: xpForNextLevel(profile.totalXp),
      currentStreak,
      longestStreak,
      freezeTokens: profile.freezeTokens,
      lives: livesSnapshot.lives,
      livesResetAt: livesSnapshot.resetsAt
        ? livesSnapshot.resetsAt.toISOString()
        : null,
      selectedExam: profile.selectedExam,
      dailyGoalMinutes: profile.dailyGoalMinutes,
      onboardingCompleted: profile.onboardingCompleted,
    });
  }
}

/**
 * Compute the most recent Monday 00:00 in America/Sao_Paulo, returned as a
 * Date in UTC. BRT = UTC-3, no DST (Brazil discontinued DST in 2019).
 *
 * Algorithm:
 *   1. Shift UTC epoch by +brtOffsetMs so getUTC*() reads BRT wall-time.
 *   2. Walk back to Monday and zero the time-of-day.
 *   3. Shift back by -brtOffsetMs so the returned Date is true UTC again.
 */
export function computeLastMondayBoundary(now: Date): Date {
  const brtOffsetMs = -3 * 60 * 60 * 1000; // UTC-3, no DST
  const brt = new Date(now.getTime() + brtOffsetMs);

  const day = brt.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat in BRT wall-time
  const daysSinceMonday = (day + 6) % 7;
  const mondayBrt = new Date(brt);
  mondayBrt.setUTCDate(brt.getUTCDate() - daysSinceMonday);
  mondayBrt.setUTCHours(0, 0, 0, 0);

  return new Date(mondayBrt.getTime() - brtOffsetMs);
}
