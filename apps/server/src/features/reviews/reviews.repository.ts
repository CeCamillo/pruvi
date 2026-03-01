import { and, desc, eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";

import type { Database } from "@pruvi/db";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-logs";
import type { Question } from "@pruvi/shared/questions";

import { DatabaseError, NotFoundError } from "../../errors";

type ReviewLogRow = typeof reviewLog.$inferSelect;

export async function getQuestion(
  db: Database,
  id: number,
): Promise<Result<Question, NotFoundError>> {
  const rows = await db.select().from(question).where(eq(question.id, id));
  const row = rows[0];
  if (!row) return err(new NotFoundError("Question", id));
  return ok(row);
}

export async function getLatestReviewLog(
  db: Database,
  userId: string,
  questionId: number,
): Promise<Result<ReviewLogRow | null, never>> {
  const rows = await db
    .select()
    .from(reviewLog)
    .where(and(eq(reviewLog.userId, userId), eq(reviewLog.questionId, questionId)))
    .orderBy(desc(reviewLog.createdAt))
    .limit(1);
  return ok(rows[0] ?? null);
}

export async function insertReviewLog(
  db: Database,
  data: typeof reviewLog.$inferInsert,
): Promise<Result<ReviewLogRow, DatabaseError>> {
  try {
    const rows = await db.insert(reviewLog).values(data).returning();
    const row = rows[0];
    if (!row) return err(new DatabaseError("Insert returned no rows"));
    return ok(row);
  } catch {
    return err(new DatabaseError());
  }
}
