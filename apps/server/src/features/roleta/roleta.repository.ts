import { eq, sql } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class RoletaRepository {
  constructor(private db: DbClient) {}

  /** Read the user's configured eligible subject slugs, or null if never set. */
  async getConfig(userId: string): Promise<string[] | null> {
    const rows = await this.db
      .select({ roletaSubjects: user.roletaSubjects })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const row = rows[0];
    return row?.roletaSubjects ?? null;
  }

  /** Overwrite the user's eligible subjects. */
  async saveConfig(userId: string, slugs: string[]): Promise<void> {
    await this.db
      .update(user)
      .set({ roletaSubjects: slugs })
      .where(eq(user.id, userId));
  }

  /** Every subject slug in the DB — used for the default pool. */
  async listSubjectSlugs(): Promise<string[]> {
    const rows = await this.db
      .select({ slug: subject.slug })
      .from(subject);
    return rows.map((r) => r.slug);
  }

  /** Look up a subject by slug. */
  async findSubjectBySlug(slug: string) {
    const rows = await this.db
      .select()
      .from(subject)
      .where(eq(subject.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Random sample of N questions from the given subject. Uses ORDER BY
   * RANDOM() — fine at our current scale (~110 questions across 5 subjects).
   * Returns fewer than N rows if the subject has fewer.
   */
  async selectRandomQuestions(subjectId: number, limit: number) {
    return this.db
      .select()
      .from(question)
      .where(eq(question.subjectId, subjectId))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }

  /** Look up a question by ID — needed for answer grading. */
  async findQuestionById(questionId: number) {
    const rows = await this.db
      .select()
      .from(question)
      .where(eq(question.id, questionId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Append a review_log row for a Roleta answer. SM-2 fields are set to
   * neutral values (interval=0, repetitions=0, ease=2.50) and nextReviewAt
   * is null — the null is the marker that scheduling does not apply.
   */
  async insertRoletaReview(data: {
    userId: string;
    questionId: number;
    quality: number;
  }): Promise<void> {
    await this.db.insert(reviewLog).values({
      userId: data.userId,
      questionId: data.questionId,
      quality: data.quality,
      easinessFactor: "2.50",
      interval: 0,
      repetitions: 0,
      nextReviewAt: null,
      source: "roleta",
    });
  }

  /** Increment user's totalXp. */
  async awardXp(userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    await this.db
      .update(user)
      .set({ totalXp: sql`${user.totalXp} + ${amount}` })
      .where(eq(user.id, userId));
  }
}
