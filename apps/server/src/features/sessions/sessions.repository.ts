import { and, asc, eq, lte, notInArray, sql, type SQL } from "drizzle-orm";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
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
          eq(sql`${dailySession.createdAt}::date`, sql`CURRENT_DATE`)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /** Create a new daily session */
  async createSession(userId: string) {
    const [row] = await this.db
      .insert(dailySession)
      .values({ userId })
      .returning();
    return row;
  }

  /** Mark a session as completed */
  async completeSession(
    sessionId: number,
    questionCount: number,
    correctCount: number
  ) {
    const [row] = await this.db
      .update(dailySession)
      .set({
        status: "completed",
        questionCount,
        correctCount,
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

  /**
   * Smart question selection using SM-2 priority:
   * 1. Overdue questions (nextReviewAt <= now, most overdue first)
   * 2. Unseen questions (no review_log entry for this user)
   * 3. Least-recently-seen as fallback
   */
  async selectQuestions(
    userId: string,
    limit: number,
    mode: "all" | "theoretical"
  ) {
    const now = new Date();
    const selected: Array<typeof question.$inferSelect> = [];

    // Base filter for paper/pen mode
    const modeFilter: SQL | undefined =
      mode === "theoretical"
        ? eq(question.requiresCalculation, false)
        : undefined;

    // 1. Overdue questions
    if (selected.length < limit) {
      const overdue = await this.db
        .select({
          id: question.id,
          subjectId: question.subjectId,
          content: question.content,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          difficulty: question.difficulty,
          requiresCalculation: question.requiresCalculation,
          source: question.source,
        })
        .from(reviewLog)
        .innerJoin(question, eq(reviewLog.questionId, question.id))
        .where(
          and(
            eq(reviewLog.userId, userId),
            lte(reviewLog.nextReviewAt, now),
            modeFilter
          )
        )
        .orderBy(asc(reviewLog.nextReviewAt))
        .limit(limit - selected.length);

      selected.push(...overdue);
    }

    // 2. Unseen questions
    if (selected.length < limit) {
      const seenIds = await this.db
        .selectDistinct({ questionId: reviewLog.questionId })
        .from(reviewLog)
        .where(eq(reviewLog.userId, userId));

      const seenQuestionIds = seenIds.map((r) => r.questionId);

      const conditions: (SQL | undefined)[] = [modeFilter];
      if (seenQuestionIds.length > 0) {
        conditions.push(notInArray(question.id, seenQuestionIds));
      }

      const unseen = await this.db
        .select()
        .from(question)
        .where(and(...conditions))
        .limit(limit - selected.length);

      selected.push(...unseen);
    }

    // 3. Least-recently-seen fallback
    if (selected.length < limit) {
      const selectedIds = selected.map((q) => q.id);
      const conditions: (SQL | undefined)[] = [modeFilter];
      if (selectedIds.length > 0) {
        conditions.push(notInArray(question.id, selectedIds));
      }

      const fallback = await this.db
        .select({
          id: question.id,
          subjectId: question.subjectId,
          content: question.content,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          difficulty: question.difficulty,
          requiresCalculation: question.requiresCalculation,
          source: question.source,
        })
        .from(reviewLog)
        .innerJoin(question, eq(reviewLog.questionId, question.id))
        .where(and(eq(reviewLog.userId, userId), ...conditions))
        .orderBy(asc(reviewLog.reviewedAt))
        .limit(limit - selected.length);

      selected.push(...fallback);
    }

    return selected;
  }
}
