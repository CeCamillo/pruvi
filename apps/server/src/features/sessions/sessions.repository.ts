import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";

import type { Database } from "@pruvi/db";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-logs";
import type { PublicQuestion } from "@pruvi/shared/sessions";

import { DatabaseError } from "../../errors";

type DailySessionRow = typeof dailySession.$inferSelect;

export async function findTodaySession(
  db: Database,
  userId: string,
): Promise<Result<DailySessionRow | null, never>> {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select()
    .from(dailySession)
    .where(and(eq(dailySession.userId, userId), eq(dailySession.date, today as string)))
    .limit(1);
  return ok(rows[0] ?? null);
}

export async function findSessionById(
  db: Database,
  id: number,
): Promise<Result<DailySessionRow | null, never>> {
  const rows = await db.select().from(dailySession).where(eq(dailySession.id, id)).limit(1);
  return ok(rows[0] ?? null);
}

export async function createSession(
  db: Database,
  userId: string,
): Promise<Result<DailySessionRow, DatabaseError>> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const rows = await db
      .insert(dailySession)
      .values({ userId, date: today as string })
      .returning();
    const row = rows[0];
    if (!row) return err(new DatabaseError("Insert returned no rows"));
    return ok(row);
  } catch {
    return err(new DatabaseError());
  }
}

export async function setSessionComplete(
  db: Database,
  id: number,
  data: { questionsAnswered: number; questionsCorrect: number },
): Promise<Result<DailySessionRow, DatabaseError>> {
  try {
    const rows = await db
      .update(dailySession)
      .set({ completedAt: new Date(), ...data })
      .where(eq(dailySession.id, id))
      .returning();
    const row = rows[0];
    if (!row) return err(new DatabaseError("Update returned no rows"));
    return ok(row);
  } catch {
    return err(new DatabaseError());
  }
}

export async function getQuestionsForSession(
  db: Database,
  userId: string,
  count: number,
): Promise<Result<PublicQuestion[], never>> {
  // Get latest review log per question for this user to determine due/new status
  const reviewedRows = await db
    .select({ questionId: reviewLog.questionId, nextReviewAt: reviewLog.nextReviewAt })
    .from(reviewLog)
    .where(eq(reviewLog.userId, userId))
    .orderBy(desc(reviewLog.createdAt));

  // Build map of questionId -> latest nextReviewAt
  const latestByQuestion = new Map<number, Date>();
  for (const row of reviewedRows) {
    if (!latestByQuestion.has(row.questionId)) {
      latestByQuestion.set(row.questionId, row.nextReviewAt);
    }
  }

  const now = new Date();
  const dueIds = [...latestByQuestion.entries()]
    .filter(([, nextAt]) => nextAt <= now)
    .map(([id]) => id);
  const allReviewedIds = [...latestByQuestion.keys()];

  const questionCols = {
    id: question.id,
    body: question.body,
    options: question.options,
    difficulty: question.difficulty,
    source: question.source,
    subjectId: question.subjectId,
    createdAt: question.createdAt,
  };

  // Prioritize due questions, fill remainder with new questions
  const dueQuestions =
    dueIds.length > 0
      ? await db
          .select(questionCols)
          .from(question)
          .where(inArray(question.id, dueIds))
          .limit(count)
      : [];

  const remaining = count - dueQuestions.length;
  const newQuestionsQuery = db.select(questionCols).from(question).limit(remaining);
  const newQuestions =
    remaining > 0
      ? allReviewedIds.length > 0
        ? await newQuestionsQuery.where(notInArray(question.id, allReviewedIds))
        : await newQuestionsQuery
      : [];

  return ok([...dueQuestions, ...newQuestions]);
}
