import { err, ok, type Result } from "neverthrow";
import {
  calculateSM2,
  INITIAL_SM2_STATE,
  type QualityScore,
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
      { correct: boolean; correctOptionIndex: number; livesRemaining: number },
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

    // 7. Decrement lives on wrong answer
    let livesRemaining = 5;
    if (!correct) {
      const userLives = await this.repo.getUserLives(userId);
      if (userLives) {
        livesRemaining = userLives.lives;

        // Auto-refill if reset time has passed
        if (
          userLives.livesResetAt &&
          userLives.livesResetAt < new Date()
        ) {
          livesRemaining = 5;
        }

        if (livesRemaining <= 0) {
          return err(
            new ValidationError("No lives remaining. Wait for refill.")
          );
        }

        // First decrement sets the reset timer
        const isFirstDecrement = livesRemaining === 5;
        await this.repo.decrementLives(
          userId,
          livesRemaining,
          isFirstDecrement
        );
        livesRemaining -= 1;
      }
    } else {
      const userLives = await this.repo.getUserLives(userId);
      if (userLives) {
        livesRemaining = userLives.lives;
        // Auto-refill if reset time has passed
        if (
          userLives.livesResetAt &&
          userLives.livesResetAt < new Date()
        ) {
          livesRemaining = 5;
        }
      }
    }

    return ok({
      correct,
      correctOptionIndex: q.correctOptionIndex,
      livesRemaining,
    });
  }
}
