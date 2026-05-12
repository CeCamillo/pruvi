import { ok, type Result } from "neverthrow";
import { type AppError } from "../../utils/errors";
import { MAX_STREAK_SHIELDS, SHIELD_REFILL_INTERVAL_MS, type ShieldUseResult } from "@pruvi/shared";
import type { ShieldsRepository } from "./shields.repository";

export class ShieldsService {
  constructor(private repo: ShieldsRepository) {}

  async getBalance(
    userId: string,
  ): Promise<Result<{ available: number; maxAvailable: typeof MAX_STREAK_SHIELDS; nextRefillAt: string | null }, AppError>> {
    const now = new Date();
    const state = await this.repo.materializeRefill(userId, now);
    let nextRefillAt: Date | null = null;
    if (state.isUltraActive && state.available < MAX_STREAK_SHIELDS && state.lastGrantAt) {
      nextRefillAt = new Date(state.lastGrantAt.getTime() + SHIELD_REFILL_INTERVAL_MS);
    } else if (state.isUltraActive && state.available < MAX_STREAK_SHIELDS && !state.lastGrantAt) {
      // Edge: Ultra user with NULL last_shield_grant_at but materializeRefill didn't grant
      // (concurrent grant lost the race). nextRefillAt = now is the truthful answer.
      nextRefillAt = now;
    }
    return ok({
      available: state.available,
      maxAvailable: MAX_STREAK_SHIELDS as typeof MAX_STREAK_SHIELDS,
      nextRefillAt: nextRefillAt?.toISOString() ?? null,
    });
  }

  async tryUseShield(userId: string, protectedDate: string): Promise<ShieldUseResult> {
    // Materialize refill first so eligible Ultra users have access to a freshly-granted shield.
    await this.repo.materializeRefill(userId, new Date());
    return this.repo.tryUseShield(userId, protectedDate);
  }
}
