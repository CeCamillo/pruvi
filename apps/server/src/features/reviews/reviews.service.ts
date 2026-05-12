import { err, ok, type Result } from "neverthrow";
import {
  calculateSM2,
  INITIAL_SM2_STATE,
  calculateXpForAnswer,
  startOfWeekBrt,
  type QualityScore,
  type Difficulty,
} from "@pruvi/shared";
import type { FastifyBaseLogger } from "fastify";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { ReviewsRepository } from "./reviews.repository";
import type { LivesRepository } from "../lives/lives.repository";
import type { Dispatcher } from "../notifications/dispatcher";
import type { FriendshipsRepository } from "../social/friendships/friendships.repository";

export class ReviewsService {
  constructor(
    private repo: ReviewsRepository,
    private livesRepo: LivesRepository,
    private dispatcher?: Dispatcher,
    private friendshipsRepo?: FriendshipsRepository,
    private logger?: FastifyBaseLogger,
  ) {}

  /** Record an answer to a question */
  async answerQuestion(
    userId: string,
    questionId: number,
    selectedOptionIndex: number,
  ): Promise<
    Result<
      {
        answer: {
          correct: boolean;
          correctOptionIndex: number;
          livesRemaining: number;
          xpAwarded: number;
          explanation: string | null;
        };
        cacheTargets: { subjectId: number; topicId: number };
      },
      AppError
    >
  > {
    // 1. Find the question
    const q = await this.repo.findQuestionById(questionId);
    if (!q) {
      return err(new NotFoundError("Question not found"));
    }

    // 2. Check correctness
    const correct = q.correctOptionIndex === selectedOptionIndex;

    // 3. Map to SM-2 quality score (correct=4, wrong=1)
    const quality: QualityScore = correct ? 4 : 1;

    // 4. Get latest review state (or use initial state)
    const latestReview = await this.repo.findLatestReview(userId, questionId);
    const previousState = latestReview
      ? {
          easinessFactor: Number(latestReview.easinessFactor),
          interval: latestReview.interval,
          repetitions: latestReview.repetitions,
          nextReviewAt: latestReview.nextReviewAt,
        }
      : INITIAL_SM2_STATE;

    // 5. Calculate new SM-2 state
    const newState = calculateSM2(previousState, quality);

    // 6. Calculate XP before inserting so it can be persisted with the review row
    const xpAwarded = calculateXpForAnswer(
      correct,
      q.difficulty as Difficulty
    );

    // 6b. Insert new review_log row (including xpEarned)
    await this.repo.insertReview({
      userId,
      questionId,
      quality,
      easinessFactor: newState.easinessFactor.toFixed(2),
      interval: newState.interval,
      repetitions: newState.repetitions,
      nextReviewAt: newState.nextReviewAt,
      xpEarned: xpAwarded,
    });

    // 6c. Award XP
    if (xpAwarded > 0) {
      await this.repo.awardXp(userId, xpAwarded);
    }

    // 6d. Fire-and-forget overtaken notification hook
    if (xpAwarded > 0 && this.dispatcher && this.friendshipsRepo) {
      void this.maybeNotifyOvertakenFriends(userId, xpAwarded).catch((e) => {
        this.logger?.error({ err: e, userId }, "overtaken notification dispatch failed");
      });
    }

    // 7. Handle lives — materialize regen, then atomic decrement on wrong answer
    const now = new Date();
    const materialized = await this.livesRepo.materializeRegen(userId, now);
    let livesRemaining = materialized.lives;

    if (!correct) {
      const decrement = await this.livesRepo.tryDecrement(userId, now);
      if (!decrement.ok) {
        return err(new ValidationError("No lives remaining. Wait for refill."));
      }
      livesRemaining = decrement.livesAfter;
    }

    return ok({
      answer: {
        correct,
        correctOptionIndex: q.correctOptionIndex,
        livesRemaining,
        xpAwarded,
        explanation: q.explanation ?? null,
      },
      cacheTargets: { subjectId: q.subjectId, topicId: q.topicId },
    });
  }

  private async maybeNotifyOvertakenFriends(userId: string, xpAwarded: number): Promise<void> {
    const weekStart = startOfWeekBrt(new Date());
    const newWeeklyXp = await this.friendshipsRepo!.getWeeklyXp(userId, weekStart);
    const previousWeeklyXp = newWeeklyXp - xpAwarded;
    const overtaken = await this.friendshipsRepo!.findOvertakenFriendIds(
      userId,
      weekStart,
      previousWeeklyXp,
      newWeeklyXp,
    );
    if (overtaken.length === 0) return;
    const me = await this.repo.findUserName(userId);
    const overtakerName = me?.name ?? "Alguém";
    await Promise.allSettled(
      overtaken.map((f) => this.dispatcher!.sendOvertakenNotification(f.friendId, overtakerName)),
    );
  }
}
