import { err, ok, type Result } from "neverthrow";
import {
  calculateSM2,
  INITIAL_SM2_STATE,
  calculateXpForAnswer,
  type QualityScore,
  type Difficulty,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { ReviewsRepository } from "./reviews.repository";

export class ReviewsService {
  constructor(private repo: ReviewsRepository) {}

  /** Record an answer to a question */
  async answerQuestion(
    userId: string,
    questionId: number,
    selectedOptionIndex: number
  ): Promise<
    Result<
      {
        correct: boolean;
        correctOptionIndex: number;
        livesRemaining: number;
        xpAwarded: number;
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

    // 6. Insert new review_log row
    await this.repo.insertReview({
      userId,
      questionId,
      quality,
      easinessFactor: newState.easinessFactor.toFixed(2),
      interval: newState.interval,
      repetitions: newState.repetitions,
      nextReviewAt: newState.nextReviewAt,
    });

    // 6b. Award XP
    const xpAwarded = calculateXpForAnswer(
      correct,
      q.difficulty as Difficulty
    );
    if (xpAwarded > 0) {
      await this.repo.awardXp(userId, xpAwarded);
    }

    // 7. Handle lives
    let livesRemaining = 5;
    const userLives = await this.repo.getUserLives(userId);

    if (userLives) {
      livesRemaining = userLives.lives;

      // Auto-refill if reset time has passed
      if (userLives.livesResetAt && userLives.livesResetAt < new Date()) {
        await this.repo.resetLives(userId);
        livesRemaining = 5;
      }

      if (!correct) {
        if (livesRemaining <= 0) {
          return err(
            new ValidationError("No lives remaining. Wait for refill.")
          );
        }

        const isFirstDecrement = livesRemaining === 5;
        await this.repo.decrementLives(
          userId,
          livesRemaining,
          isFirstDecrement
        );
        livesRemaining -= 1;
      }
    }

    return ok({
      correct,
      correctOptionIndex: q.correctOptionIndex,
      livesRemaining,
      xpAwarded,
    });
  }
}
