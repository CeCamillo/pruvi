import { err, ok, type Result } from "neverthrow";
import {
  calculateSm2,
  INITIAL_SM2_STATE,
  calculateXpForAnswer,
  difficultyFromNumber,
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
          quality,
          repetitions: latestReview.repetitions,
          easeFactor: Number(latestReview.easinessFactor),
          interval: latestReview.interval,
        }
      : { ...INITIAL_SM2_STATE, quality };

    // 5. Calculate new SM-2 state
    const newState = calculateSm2(previousState)._unsafeUnwrap();

    // 6. Insert new review_log row
    await this.repo.insertReview({
      userId,
      questionId,
      quality,
      easinessFactor: newState.easeFactor.toFixed(2),
      interval: newState.interval,
      repetitions: newState.repetitions,
      nextReviewAt: new Date(newState.nextReviewAt),
    });

    // 6b. Award XP
    const xpAwarded = calculateXpForAnswer(
      correct,
      difficultyFromNumber(q.difficulty)
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
