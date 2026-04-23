import { and, eq, sql } from "drizzle-orm";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import type { db } from "@pruvi/db";

export type DbClient = typeof db;

export class SessionsRepository {
  constructor(private db: DbClient) {}

  /** Find today's session for a user (active or completed) */
  async findTodaySession(userId: string) {
    const rows = await this.db
      .select()
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          eq(dailySession.date, sql`CURRENT_DATE`),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /** Create a new daily session for today */
  async createSession(userId: string) {
    const [row] = await this.db
      .insert(dailySession)
      .values({
        userId,
        date: sql`CURRENT_DATE`,
      })
      .returning();
    return row;
  }

  /** Mark a session as completed */
  async completeSession(
    sessionId: number,
    questionCount: number,
    correctCount: number,
  ) {
    const [row] = await this.db
      .update(dailySession)
      .set({
        questionsAnswered: questionCount,
        questionsCorrect: correctCount,
        completedAt: new Date(),
      })
      .where(eq(dailySession.id, sessionId))
      .returning();
    return row;
  }

  /** Find a session by ID */
  async findSessionById(sessionId: number) {
    const rows = await this.db
      .select()
      .from(dailySession)
      .where(eq(dailySession.id, sessionId))
      .limit(1);
    return rows[0] ?? null;
  }
}
