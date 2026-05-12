import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

export class UltraRepository {
  constructor(private db: Db) {}

  async get(userId: string): Promise<{ isUltra: boolean; ultraExpiresAt: Date | null } | null> {
    const rows = await this.db
      .select({ isUltra: user.isUltra, ultraExpiresAt: user.ultraExpiresAt })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async grant(userId: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(user)
      .set({ isUltra: true, ultraExpiresAt: expiresAt })
      .where(eq(user.id, userId));
  }

  async revoke(userId: string): Promise<void> {
    await this.db
      .update(user)
      .set({ isUltra: false, ultraExpiresAt: null })
      .where(eq(user.id, userId));
  }
}
