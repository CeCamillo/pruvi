import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

export class SessionPreferencesRepository {
  constructor(private db: Db) {}

  async get(userId: string): Promise<{ showTimer: boolean } | null> {
    const rows = await this.db
      .select({ showTimer: user.showTimer })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async update(userId: string, patch: { showTimer: boolean }): Promise<{ showTimer: boolean } | null> {
    const rows = await this.db
      .update(user)
      .set({ showTimer: patch.showTimer })
      .where(eq(user.id, userId))
      .returning({ showTimer: user.showTimer });
    return rows[0] ?? null;
  }
}
