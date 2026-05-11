import { eq, sql, and, gt } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";
import { MAX_LIVES, computeRegenSnapshot } from "@pruvi/shared";

type DbClient = typeof db;

export class LivesRepository {
  constructor(private db: DbClient) {}

  async getUserLives(userId: string) {
    const rows = await this.db
      .select({
        lives: user.lives,
        livesLastRegenAt: user.livesLastRegenAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async materializeRegen(
    userId: string,
    now: Date,
  ): Promise<{ lives: number; lastRegenAt: Date | null }> {
    const current = await this.getUserLives(userId);
    if (!current) {
      return { lives: MAX_LIVES, lastRegenAt: null };
    }
    const snap = computeRegenSnapshot(current.lives, current.livesLastRegenAt, now);
    if (snap.regenerated > 0) {
      await this.db
        .update(user)
        .set({ lives: snap.lives, livesLastRegenAt: snap.lastRegenAt })
        .where(eq(user.id, userId));
    }
    return { lives: snap.lives, lastRegenAt: snap.lastRegenAt };
  }

  async tryDecrement(
    userId: string,
    now: Date,
  ): Promise<
    | { ok: true; livesAfter: number; lastRegenAt: Date | null }
    | { ok: false }
  > {
    const result = await this.db
      .update(user)
      .set({
        lives: sql`${user.lives} - 1`,
        livesLastRegenAt: sql`COALESCE(${user.livesLastRegenAt}, ${now})`,
      })
      .where(and(eq(user.id, userId), gt(user.lives, 0)))
      .returning({
        lives: user.lives,
        livesLastRegenAt: user.livesLastRegenAt,
      });

    const row = result[0];
    if (!row) return { ok: false };
    return { ok: true, livesAfter: row.lives, lastRegenAt: row.livesLastRegenAt };
  }
}
