import { ok, type Result } from "neverthrow";
import { MAX_LIVES, nextRegenAt } from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import type { LivesRepository } from "./lives.repository";

export class LivesService {
  constructor(private repo: LivesRepository) {}

  async getLives(
    userId: string,
  ): Promise<
    Result<
      { lives: number; maxLives: number; bonusLives: number; resetsAt: Date | null; unlimited: boolean },
      AppError
    >
  > {
    const state = await this.repo.materializeRegen(userId, new Date());
    return ok({
      lives: state.lives,
      maxLives: MAX_LIVES,
      bonusLives: state.bonusLives,
      resetsAt: state.isUltra ? null : nextRegenAt(state.lives, state.lastRegenAt),
      unlimited: state.isUltra,
    });
  }
}
