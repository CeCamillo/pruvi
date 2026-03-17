import { and, desc, eq, sql } from "drizzle-orm";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";
import { MAX_LIVES } from "@pruvi/shared";

type DbClient = typeof db;

export class ReviewsRepository {
  constructor(private db: DbClient) {}

  /** Get a question by ID (including correctOptionIndex for answer checking) */
  async findQuestionById(questionId: number) {
    const rows = await this.db
      .select()
      .from(question)
      .where(eq(question.id, questionId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Get the latest review_log entry for a user+question pair */
  async findLatestReview(userId: string, questionId: number) {
    const rows = await this.db
      .select()
      .from(reviewLog)
      .where(
        and(
          eq(reviewLog.userId, userId),
          eq(reviewLog.questionId, questionId)
        )
      )
      .orderBy(desc(reviewLog.reviewedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Insert a new review_log row (append-only) */
  async insertReview(data: {
    userId: string;
    questionId: number;
    quality: number;
    easinessFactor: string;
    interval: number;
    repetitions: number;
    nextReviewAt: Date;
  }) {
    const [row] = await this.db
      .insert(reviewLog)
      .values(data)
      .returning();
    return row;
  }

  /** Get user's current lives */
  async getUserLives(userId: string) {
    const rows = await this.db
      .select({
        lives: user.lives,
        livesResetAt: user.livesResetAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Award XP to user */
  async awardXp(userId: string, xpAmount: number) {
    await this.db
      .update(user)
      .set({
        totalXp: sql`${user.totalXp} + ${xpAmount}`,
      })
      .where(eq(user.id, userId));
  }

  /** Reset lives to MAX and clear the timer */
  async resetLives(userId: string) {
    await this.db
      .update(user)
      .set({ lives: MAX_LIVES, livesResetAt: null })
      .where(eq(user.id, userId));
  }

  /** Decrement user's lives by 1 */
  async decrementLives(userId: string, currentLives: number, setResetAt: boolean) {
    const updates: Record<string, unknown> = {
      lives: currentLives - 1,
    };
    if (setResetAt) {
      updates.livesResetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    await this.db
      .update(user)
      .set(updates)
      .where(eq(user.id, userId));
  }
}
