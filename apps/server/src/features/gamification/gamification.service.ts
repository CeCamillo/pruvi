import { ok, err, type Result } from "neverthrow";
import {
  calculateXpForAnswer,
  getLevelForXp,
  xpForNextLevel,
  type Difficulty,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError } from "../../utils/errors";
import type { GamificationRepository } from "./gamification.repository";

export class GamificationService {
  constructor(private repo: GamificationRepository) {}

  /** Get user's XP, level, and XP needed for next level */
  async getXp(
    userId: string
  ): Promise<
    Result<
      { totalXp: number; currentLevel: number; xpForNextLevel: number },
      AppError
    >
  > {
    const data = await this.repo.getUserXp(userId);
    if (!data) {
      return err(new NotFoundError("User not found"));
    }

    return ok({
      totalXp: data.totalXp,
      currentLevel: data.currentLevel,
      xpForNextLevel: xpForNextLevel(data.totalXp),
    });
  }

  /** Award XP for answering a question */
  async awardXpForAnswer(
    userId: string,
    correct: boolean,
    difficulty: Difficulty
  ): Promise<
    Result<
      { xpAwarded: number; totalXp: number; currentLevel: number },
      AppError
    >
  > {
    const xpAwarded = calculateXpForAnswer(correct, difficulty);
    if (xpAwarded === 0) {
      // No XP for wrong answers — return current state
      const data = await this.repo.getUserXp(userId);
      return ok({
        xpAwarded: 0,
        totalXp: data?.totalXp ?? 0,
        currentLevel: data?.currentLevel ?? 1,
      });
    }

    // Get current XP to calculate new level
    const current = await this.repo.getUserXp(userId);
    const currentXp = current?.totalXp ?? 0;
    const newLevel = getLevelForXp(currentXp + xpAwarded);

    const updated = await this.repo.awardXp(userId, xpAwarded, newLevel);

    return ok({
      xpAwarded,
      totalXp: updated?.totalXp ?? currentXp + xpAwarded,
      currentLevel: updated?.currentLevel ?? newLevel,
    });
  }
}
