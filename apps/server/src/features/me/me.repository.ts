import { eq, sql } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class MeRepository {
  constructor(private db: DbClient) {}

  async getProfile(userId: string) {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
        totalXp: user.totalXp,
        weeklyXp: user.weeklyXp,
        weeklyXpResetAt: user.weeklyXpResetAt,
        currentLevel: user.currentLevel,
        freezeTokens: user.freezeTokens,
        lives: user.lives,
        livesResetAt: user.livesResetAt,
        selectedExam: user.selectedExam,
        dailyGoalMinutes: user.dailyGoalMinutes,
        onboardingCompleted: user.onboardingCompleted,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Reset weekly_xp for ONE user (used by self-heal). */
  async resetWeeklyXpForUser(userId: string) {
    await this.db
      .update(user)
      .set({ weeklyXp: 0, weeklyXpResetAt: sql`NOW()` })
      .where(eq(user.id, userId));
  }

  /** Reset weekly_xp for ALL users (used by the cron worker). */
  async resetWeeklyXpForAll() {
    await this.db
      .update(user)
      .set({ weeklyXp: 0, weeklyXpResetAt: sql`NOW()` });
  }
}
