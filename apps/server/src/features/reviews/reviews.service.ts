import { type Result, err, ok } from "neverthrow";

import type { Database } from "@pruvi/db";
import type { AnswerResponse } from "@pruvi/shared/questions";
import { calculateSm2 } from "@pruvi/shared/sm2";

import type { AppError } from "../../errors";
import { getLatestReviewLog, getQuestion, insertReviewLog } from "./reviews.repository";

type RecordAnswerParams = {
  userId: string;
  questionId: number;
  selectedOptionIndex: number;
};

const SM2_DEFAULTS = { repetitions: 0, easeFactor: 2.5, interval: 0 } as const;
const QUALITY_CORRECT = 5;
const QUALITY_WRONG = 0;

export async function recordAnswer(
  db: Database,
  params: RecordAnswerParams,
): Promise<Result<AnswerResponse, AppError>> {
  const { userId, questionId, selectedOptionIndex } = params;

  const questionResult = await getQuestion(db, questionId);
  if (questionResult.isErr()) return err(questionResult.error);

  const q = questionResult.value;
  const correct = selectedOptionIndex === q.correctOptionIndex;
  const quality = correct ? QUALITY_CORRECT : QUALITY_WRONG;

  const priorLogResult = await getLatestReviewLog(db, userId, questionId);
  if (priorLogResult.isErr()) return err(priorLogResult.error);

  const prior = priorLogResult.value ?? SM2_DEFAULTS;
  // calculateSm2 returns Result<T, never> — it always succeeds
  const { repetitions, easeFactor, interval, nextReviewAt } = calculateSm2({
    quality,
    repetitions: prior.repetitions,
    easeFactor: prior.easeFactor,
    interval: prior.interval,
  })._unsafeUnwrap();

  const logResult = await insertReviewLog(db, {
    userId,
    questionId,
    quality,
    repetitions,
    easeFactor,
    interval,
    nextReviewAt: new Date(nextReviewAt),
  });
  if (logResult.isErr()) return err(logResult.error);

  return ok({
    correct,
    correctOptionIndex: q.correctOptionIndex,
    reviewLog: { easeFactor, interval, repetitions, nextReviewAt },
  });
}
