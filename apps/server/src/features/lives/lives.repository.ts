import { eq, sql, and, gt } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";
import { MAX_LIVES, computeRegenSnapshot } from "@pruvi/shared";

type DbClient = typeof db;

function isUltraActive(row: { isUltra: boolean; ultraExpiresAt: Date | null }, now: Date): boolean {
  return row.isUltra && (!row.ultraExpiresAt || row.ultraExpiresAt > now);
}

export class LivesRepository {
  constructor(private db: DbClient) {}

  async getUserLives(userId: string) {
    const rows = await this.db
      .select({
        lives: user.lives,
        bonusLives: user.bonusLives,
        livesLastRegenAt: user.livesLastRegenAt,
        isUltra: user.isUltra,
        ultraExpiresAt: user.ultraExpiresAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async materializeRegen(
    userId: string,
    now: Date,
  ): Promise<{ lives: number; bonusLives: number; lastRegenAt: Date | null; isUltra: boolean }> {
    const current = await this.getUserLives(userId);
    if (!current) {
      return { lives: MAX_LIVES, bonusLives: 0, lastRegenAt: null, isUltra: false };
    }

    // Ultra bypass: skip regen logic entirely
    if (isUltraActive(current, now)) {
      return { lives: MAX_LIVES, bonusLives: current.bonusLives, lastRegenAt: null, isUltra: true };
    }

    const snap = computeRegenSnapshot(current.lives, current.livesLastRegenAt, now);
    if (snap.regenerated > 0) {
      await this.db
        .update(user)
        .set({ lives: snap.lives, livesLastRegenAt: snap.lastRegenAt })
        .where(eq(user.id, userId));
    }
    return { lives: snap.lives, bonusLives: current.bonusLives, lastRegenAt: snap.lastRegenAt, isUltra: false };
  }

  async tryDecrement(
    userId: string,
    now: Date,
  ): Promise<
    | { ok: true; livesAfter: number; bonusLivesAfter: number; lastRegenAt: Date | null; isUltra: boolean }
    | { ok: false }
  > {
    // Ultra bypass: skip atomic UPDATE entirely
    const current = await this.getUserLives(userId);
    if (current && isUltraActive(current, now)) {
      return { ok: true, livesAfter: MAX_LIVES, bonusLivesAfter: current.bonusLives, lastRegenAt: null, isUltra: true };
    }

    // Attempt 1: drain bonus_lives if > 0 (atomic, predicate-in-WHERE)
    const bonusResult = await this.db
      .update(user)
      .set({ bonusLives: sql`${user.bonusLives} - 1` })
      .where(and(eq(user.id, userId), gt(user.bonusLives, 0)))
      .returning({ lives: user.lives, bonusLives: user.bonusLives, livesLastRegenAt: user.livesLastRegenAt });

    if (bonusResult[0]) {
      return {
        ok: true,
        livesAfter: bonusResult[0].lives,
        bonusLivesAfter: bonusResult[0].bonusLives,
        lastRegenAt: bonusResult[0].livesLastRegenAt,
        isUltra: false,
      };
    }

    // Attempt 2: existing regen-pool decrement
    const result = await this.db
      .update(user)
      .set({
        lives: sql`${user.lives} - 1`,
        livesLastRegenAt: sql`COALESCE(${user.livesLastRegenAt}, ${now})`,
      })
      .where(and(eq(user.id, userId), gt(user.lives, 0)))
      .returning({
        lives: user.lives,
        bonusLives: user.bonusLives,
        livesLastRegenAt: user.livesLastRegenAt,
      });

    const row = result[0];
    if (!row) return { ok: false };
    return { ok: true, livesAfter: row.lives, bonusLivesAfter: row.bonusLives, lastRegenAt: row.livesLastRegenAt, isUltra: false };
  }
}
