import { and, desc, eq, isNotNull } from "drizzle-orm";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class StreaksRepository {
  constructor(private db: DbClient) {}

  /** Get all completed session dates for a user, newest first (YYYY-MM-DD strings) */
  async getCompletedSessionDates(userId: string) {
    const rows = await this.db
      .selectDistinct({ date: dailySession.date })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          isNotNull(dailySession.completedAt),
        ),
      )
      .orderBy(desc(dailySession.date));

    return rows.map((r) => r.date);
  }

  /** Count total completed sessions for a user */
  async countCompletedSessions(userId: string) {
    const rows = await this.db
      .select({ id: dailySession.id })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          isNotNull(dailySession.completedAt),
        ),
      );
    return rows.length;
  }
}
