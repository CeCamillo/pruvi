import { type Result, err, ok } from "neverthrow";

import type { Database } from "@pruvi/db";
import type { DailySession, StartSessionResponse } from "@pruvi/shared/sessions";

import { ConflictError, ForbiddenError, NotFoundError, type AppError } from "../../errors";
import {
  createSession,
  findSessionById,
  findTodaySession,
  getQuestionsForSession,
  setSessionComplete,
} from "./sessions.repository";

type QueueLike = {
  add(name: string, data: Record<string, unknown>): Promise<unknown>;
};

type DailySessionRow = {
  id: number;
  userId: string;
  date: string;
  questionsAnswered: number;
  questionsCorrect: number;
  completedAt: Date | null;
  createdAt: Date;
};

function serializeSession(row: DailySessionRow): DailySession {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    questionsAnswered: row.questionsAnswered,
    questionsCorrect: row.questionsCorrect,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function startSession(
  db: Database,
  params: { userId: string; count?: number },
): Promise<Result<StartSessionResponse, AppError>> {
  const { userId, count = 5 } = params;

  // Resume existing incomplete session
  const todayResult = await findTodaySession(db, userId);
  if (todayResult.isErr()) return err(todayResult.error);

  const existing = todayResult.value;
  if (existing && !existing.completedAt) {
    const questionsResult = await getQuestionsForSession(db, userId, count);
    if (questionsResult.isErr()) return err(questionsResult.error);
    return ok({ session: serializeSession(existing), questions: questionsResult.value });
  }

  // Create new session
  const sessionResult = await createSession(db, userId);
  if (sessionResult.isErr()) return err(sessionResult.error);

  const questionsResult = await getQuestionsForSession(db, userId, count);
  if (questionsResult.isErr()) return err(questionsResult.error);

  return ok({ session: serializeSession(sessionResult.value), questions: questionsResult.value });
}

export async function completeSession(
  db: Database,
  queue: QueueLike,
  params: {
    sessionId: number;
    userId: string;
    questionsAnswered: number;
    questionsCorrect: number;
  },
): Promise<Result<DailySession, AppError>> {
  const { sessionId, userId, questionsAnswered, questionsCorrect } = params;

  const sessionResult = await findSessionById(db, sessionId);
  if (sessionResult.isErr()) return err(sessionResult.error);

  const session = sessionResult.value;
  if (!session) return err(new NotFoundError("Session", sessionId));
  if (session.userId !== userId) return err(new ForbiddenError());
  if (session.completedAt) return err(new ConflictError("Session already completed"));

  const updateResult = await setSessionComplete(db, sessionId, {
    questionsAnswered,
    questionsCorrect,
  });
  if (updateResult.isErr()) return err(updateResult.error);

  // Fire-and-forget: pre-generate next session in background
  await queue.add("generate-next-session", { userId });

  return ok(serializeSession(updateResult.value));
}

export async function getTodayInfo(
  db: Database,
  userId: string,
): Promise<Result<DailySession | null, never>> {
  const result = await findTodaySession(db, userId);
  if (result.isErr()) return err(result.error);
  return ok(result.value ? serializeSession(result.value) : null);
}
