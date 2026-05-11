import { and, eq, gte, lt, sql } from "drizzle-orm";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { question } from "@pruvi/db/schema/questions";
import { subject } from "@pruvi/db/schema/subjects";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export interface SubjectAggregate {
  subjectSlug: string;
  subjectName: string;
  totalReviews: number;
  totalCorrect: number;
}

export class ProgressRepository {
  constructor(private db: DbClient) {}

  /** Aggregate review_log per subject for a user. One row per subject the user has reviewed. */
  async getProgressBySubject(userId: string): Promise<SubjectAggregate[]> {
    const rows = await this.db
      .select({
        subjectSlug: subject.slug,
        subjectName: subject.name,
        totalReviews: sql<number>`COUNT(*)::int`,
        totalCorrect: sql<number>`SUM(CASE WHEN ${reviewLog.quality} >= 3 THEN 1 ELSE 0 END)::int`,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .innerJoin(subject, eq(subject.id, question.subjectId))
      .where(eq(reviewLog.userId, userId))
      .groupBy(subject.id, subject.slug, subject.name)
      .orderBy(subject.name);

    return rows;
  }

  /** Distinct dates (YYYY-MM-DD) where user completed at least one daily_session in [from, to]. */
  async getCompletedDatesInRange(
    userId: string,
    from: string,
    to: string
  ): Promise<string[]> {
    const rows = await this.db
      .select({
        day: sql<string>`(${dailySession.createdAt}::date)::text`,
      })
      .from(dailySession)
      .where(
        and(
          eq(dailySession.userId, userId),
          eq(dailySession.status, "completed"),
          gte(dailySession.createdAt, sql`${from}::timestamp`),
          lt(dailySession.createdAt, sql`(${to}::date + INTERVAL '1 day')::timestamp`)
        )
      )
      .groupBy(sql`(${dailySession.createdAt}::date)`)
      .orderBy(sql`(${dailySession.createdAt}::date)`);

    return rows.map((r) => r.day);
  }
}
