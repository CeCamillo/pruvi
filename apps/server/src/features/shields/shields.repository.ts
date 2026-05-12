import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { streakShieldUsage } from "@pruvi/db/schema/streak-shield-usage";
import { MAX_STREAK_SHIELDS, SHIELD_REFILL_INTERVAL_MS, type ShieldUseResult } from "@pruvi/shared";

type Db = typeof DbClient;

export class ShieldsRepository {
  constructor(private db: Db) {}

  async getUserShieldState(userId: string) {
    const rows = await this.db
      .select({
        streakShieldsAvailable: user.streakShieldsAvailable,
        lastShieldGrantAt: user.lastShieldGrantAt,
        isUltra: user.isUltra,
        ultraExpiresAt: user.ultraExpiresAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Apply lazy refill if eligible. Single-grant model (MAX=1, per spec v2): an
   * Ultra-active user with 0 shields and either a NULL anchor or anchor >= 30d
   * old gets exactly 1 shield. Race-safe via conditional UPDATE.
   */
  async materializeRefill(
    userId: string,
    now: Date,
  ): Promise<{ available: number; lastGrantAt: Date | null; isUltraActive: boolean }> {
    const current = await this.getUserShieldState(userId);
    if (!current) return { available: 0, lastGrantAt: null, isUltraActive: false };
    const ultraActive = current.isUltra && (!current.ultraExpiresAt || current.ultraExpiresAt > now);
    if (!ultraActive) {
      return { available: current.streakShieldsAvailable, lastGrantAt: current.lastShieldGrantAt, isUltraActive: false };
    }
    if (current.streakShieldsAvailable >= MAX_STREAK_SHIELDS) {
      return { available: current.streakShieldsAvailable, lastGrantAt: current.lastShieldGrantAt, isUltraActive: true };
    }
    const eligible =
      current.lastShieldGrantAt === null ||
      now.getTime() - current.lastShieldGrantAt.getTime() >= SHIELD_REFILL_INTERVAL_MS;
    if (!eligible) {
      return { available: current.streakShieldsAvailable, lastGrantAt: current.lastShieldGrantAt, isUltraActive: true };
    }
    // Race-safe conditional UPDATE: WHERE predicate re-evaluates inside row-level lock.
    const whereConditions =
      current.lastShieldGrantAt === null
        ? and(eq(user.id, userId), eq(user.streakShieldsAvailable, 0), isNull(user.lastShieldGrantAt))
        : and(
            eq(user.id, userId),
            eq(user.streakShieldsAvailable, 0),
            lt(user.lastShieldGrantAt, new Date(now.getTime() - SHIELD_REFILL_INTERVAL_MS)),
          );
    const updated = await this.db
      .update(user)
      .set({ streakShieldsAvailable: 1, lastShieldGrantAt: now })
      .where(whereConditions)
      .returning({ available: user.streakShieldsAvailable, lastGrantAt: user.lastShieldGrantAt });
    if (updated.length === 0) {
      // Concurrent grant won. Re-read.
      const fresh = await this.getUserShieldState(userId);
      return { available: fresh?.streakShieldsAvailable ?? 0, lastGrantAt: fresh?.lastShieldGrantAt ?? null, isUltraActive: true };
    }
    return { available: updated[0]!.available, lastGrantAt: updated[0]!.lastGrantAt, isUltraActive: true };
  }

  /**
   * Atomic decrement + protection insert. Returns `{ used: true }` only when
   * both succeed; UNIQUE conflict on (user_id, protected_date) rolls back
   * the decrement via thrown error.
   */
  async tryUseShield(userId: string, protectedDate: string): Promise<ShieldUseResult> {
    try {
      return await this.db.transaction(async (tx) => {
        // 1. Conditional decrement — only succeeds when shields > 0 (predicate inside row lock).
        const dec = await tx
          .update(user)
          .set({ streakShieldsAvailable: sql`${user.streakShieldsAvailable} - 1` })
          .where(and(eq(user.id, userId), gt(user.streakShieldsAvailable, 0)))
          .returning({ available: user.streakShieldsAvailable });
        if (dec.length === 0) return { used: false, balanceAfter: null };

        // 2. Insert protection row. UNIQUE conflict → throw to roll back the decrement.
        try {
          await tx.insert(streakShieldUsage).values({ userId, protectedDate });
        } catch (_e) {
          throw new Error("ALREADY_PROTECTED");
        }
        return { used: true, balanceAfter: dec[0]!.available };
      });
    } catch (e) {
      if (e instanceof Error && e.message === "ALREADY_PROTECTED") {
        return { used: false, balanceAfter: null };
      }
      throw e;
    }
  }

  async listProtectedDates(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ protectedDate: streakShieldUsage.protectedDate })
      .from(streakShieldUsage)
      .where(eq(streakShieldUsage.userId, userId));
    return rows.map((r) =>
      typeof r.protectedDate === "string" ? r.protectedDate : new Date(r.protectedDate).toISOString().slice(0, 10),
    );
  }
}
