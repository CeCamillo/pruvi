import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";
import { MAX_LIVES } from "@pruvi/shared";

type DbClient = typeof db;

export class LivesRepository {
  constructor(private db: DbClient) {}

  async getUserLives(userId: string) {
    const rows = await this.db
      .select({
        lives: user.lives,
        livesResetAt: user.livesResetAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Reset lives to MAX and clear the timer */
  async resetLives(userId: string) {
    await this.db
      .update(user)
      .set({ lives: MAX_LIVES, livesResetAt: null })
      .where(eq(user.id, userId));
  }
}
