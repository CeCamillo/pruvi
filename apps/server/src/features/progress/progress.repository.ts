import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { subject } from "@pruvi/db/schema/subjects";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export interface SubjectProgressRow {
  slug: string;
  name: string;
  totalQuestions: number;
  correctCount: number;
}

export interface SubjectReviewRow {
  questionId: number;
  body: string;
  quality: number;
  reviewedAt: Date;
}

export class ProgressRepository {
  constructor(private db: DbClient) {}

  /** Aggregate review_log by subject for a user. Only subjects with >= 1 row surface. */
  async getProgressForUser(userId: string): Promise<SubjectProgressRow[]> {
    const rows = await this.db
      .select({
        slug: subject.slug,
        name: subject.name,
        totalQuestions: sql<number>`COUNT(*)::int`,
        correctCount: sql<number>`SUM(CASE WHEN ${reviewLog.quality} >= 3 THEN 1 ELSE 0 END)::int`,
        lastActivity: sql<Date>`MAX(${reviewLog.reviewedAt})`,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(eq(reviewLog.userId, userId))
      .groupBy(subject.slug, subject.name)
      .orderBy(desc(sql`MAX(${reviewLog.reviewedAt})`));

    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      totalQuestions: r.totalQuestions,
      correctCount: r.correctCount,
    }));
  }

  /** Most recent N review_log rows for a user scoped to one subject slug. */
  async getSubjectReviews(
    userId: string,
    slug: string,
    limit = 50,
  ): Promise<SubjectReviewRow[]> {
    const rows = await this.db
      .select({
        questionId: reviewLog.questionId,
        body: question.body,
        quality: reviewLog.quality,
        reviewedAt: reviewLog.reviewedAt,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(and(eq(reviewLog.userId, userId), eq(subject.slug, slug)))
      .orderBy(desc(reviewLog.reviewedAt))
      .limit(limit);

    return rows;
  }

  async subjectExists(slug: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: subject.id })
      .from(subject)
      .where(eq(subject.slug, slug))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Distinct YYYY-MM-DD strings of completed daily_session rows inside [start, end).
   * `monthStart` / `monthEnd` are YYYY-MM-DD strings — not Date objects — so the
   * range is evaluated in the DB column's native type with no timezone coercion.
   */
  async getCalendarDates(
    userId: string,
    monthStart: string,
    monthEnd: string,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({
        date: sql<string>`to_char(${dailySession.date}, 'YYYY-MM-DD')`,
      })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          gte(dailySession.date, monthStart),
          lt(dailySession.date, monthEnd),
          sql`${dailySession.completedAt} IS NOT NULL`,
        ),
      )
      .orderBy(sql`to_char(${dailySession.date}, 'YYYY-MM-DD')`);

    return rows.map((r) => r.date);
  }
}
