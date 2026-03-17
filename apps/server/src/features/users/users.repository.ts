import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class UsersRepository {
  constructor(private db: DbClient) {}

  /** Get user profile data */
  async getProfile(userId: string) {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        lives: user.lives,
        totalXp: user.totalXp,
        currentLevel: user.currentLevel,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Get all sessions for data export */
  async getAllSessions(userId: string) {
    return this.db
      .select()
      .from(dailySession)
      .where(eq(dailySession.userId, userId));
  }

  /** Get all review logs for data export */
  async getAllReviews(userId: string) {
    return this.db
      .select()
      .from(reviewLog)
      .where(eq(reviewLog.userId, userId));
  }

  /** Delete user — cascades to all related tables via FK constraints */
  async deleteUser(userId: string) {
    await this.db.delete(user).where(eq(user.id, userId));
  }
}
