import { and, desc, eq, sql } from "drizzle-orm";
import { question } from "@pruvi/db/schema/questions";
import { subtopic } from "@pruvi/db/schema/topics";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class ReviewsRepository {
  constructor(private db: DbClient) {}

  /** Get a question by ID (including correctOptionIndex for answer checking) */
  async findQuestionById(questionId: number) {
    const rows = await this.db
      .select({
        id: question.id,
        content: question.content,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        difficulty: question.difficulty,
        explanation: question.explanation,
        subjectId: question.subjectId,
        subtopicId: question.subtopicId,
        topicId: subtopic.topicId,
      })
      .from(question)
      .innerJoin(subtopic, eq(subtopic.id, question.subtopicId))
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
    xpEarned: number;
  }) {
    const [row] = await this.db
      .insert(reviewLog)
      .values(data)
      .returning();
    return row;
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

}
