import { and, desc, eq, sql } from "drizzle-orm";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class StreaksRepository {
  constructor(private db: DbClient) {}

  /** Get all completed session dates for a user, ordered newest first.
   *  Returns DISTINCT BRT-local calendar dates (one row per day) as YYYY-MM-DD strings.
   */
  async getCompletedSessionDates(userId: string) {
    const rows = await this.db
      .selectDistinct({
        date: sql<string>`(${dailySession.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date`.as("date"),
      })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          eq(dailySession.status, "completed")
        )
      )
      .orderBy(desc(sql`(${dailySession.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date`));

    return rows.map((r) => r.date);
  }

  /** Count total completed sessions for a user */
  async countCompletedSessions(userId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          eq(dailySession.status, "completed")
        )
      );
    return row?.count ?? 0;
  }
}
