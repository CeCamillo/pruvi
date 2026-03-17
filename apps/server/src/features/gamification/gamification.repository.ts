import { eq, sql } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class GamificationRepository {
  constructor(private db: DbClient) {}

  /** Get user's XP and level */
  async getUserXp(userId: string) {
    const rows = await this.db
      .select({
        totalXp: user.totalXp,
        currentLevel: user.currentLevel,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Award XP and update level atomically */
  async awardXp(userId: string, xpAmount: number, newLevel: number) {
    const [row] = await this.db
      .update(user)
      .set({
        totalXp: sql`${user.totalXp} + ${xpAmount}`,
        currentLevel: newLevel,
      })
      .where(eq(user.id, userId))
      .returning({
        totalXp: user.totalXp,
        currentLevel: user.currentLevel,
      });
    return row;
  }
}
