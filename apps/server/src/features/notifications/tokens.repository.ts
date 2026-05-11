import { and, eq, inArray } from "drizzle-orm";
import { pushToken } from "@pruvi/db/schema/push-tokens";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class TokensRepository {
  constructor(private db: DbClient) {}

  async upsert(userId: string, token: string, platform: "ios" | "android") {
    const [row] = await this.db
      .insert(pushToken)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: pushToken.token,
        set: { userId, platform, lastUsedAt: new Date() },
      })
      .returning();
    return row;
  }

  async listByUser(userId: string) {
    return this.db
      .select()
      .from(pushToken)
      .where(eq(pushToken.userId, userId));
  }

  async deleteForUser(userId: string, token: string) {
    await this.db
      .delete(pushToken)
      .where(and(eq(pushToken.userId, userId), eq(pushToken.token, token)));
  }

  async deleteTokens(tokens: string[]) {
    if (tokens.length === 0) return;
    await this.db.delete(pushToken).where(inArray(pushToken.token, tokens));
  }
}
