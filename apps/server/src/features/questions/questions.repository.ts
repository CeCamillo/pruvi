import { and, asc, eq, lte, notInArray, type SQL } from "drizzle-orm";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { subject } from "@pruvi/db/schema/subjects";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class QuestionsRepository {
  constructor(private db: DbClient) {}

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

  /** Look up the slug of the subject owning a question. Used by cache invalidation. */
  async getSubjectSlugForQuestion(questionId: number): Promise<string | null> {
    const rows = await this.db
      .select({ slug: subject.slug })
      .from(question)
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(eq(question.id, questionId))
      .limit(1);
    return rows[0]?.slug ?? null;
  }
}
