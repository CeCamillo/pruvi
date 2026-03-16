import { ok, type Result } from "neverthrow";
import { MAX_LIVES } from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import type { LivesRepository } from "./lives.repository";

export class LivesService {
  constructor(private repo: LivesRepository) {}

  async getLives(
    userId: string
  ): Promise<
    Result<
      { lives: number; maxLives: number; resetsAt: Date | null },
      AppError
    >
  > {
    const userLives = await this.repo.getUserLives(userId);

    if (!userLives) {
      return ok({ lives: MAX_LIVES, maxLives: MAX_LIVES, resetsAt: null });
    }

    let { lives, livesResetAt } = userLives;

    // Auto-refill if reset time has passed
    if (livesResetAt && livesResetAt < new Date()) {
      await this.repo.resetLives(userId);
      lives = MAX_LIVES;
      livesResetAt = null;
    }

    return ok({
      lives,
      maxLives: MAX_LIVES,
      resetsAt: livesResetAt,
    });
  }
}
