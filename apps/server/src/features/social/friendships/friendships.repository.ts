import { and, eq, or, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { friendship } from "@pruvi/db/schema/friendship";

type Db = typeof DbClient;

export class FriendshipsRepository {
  constructor(private db: Db) {}

  async findByUsername(username: string) {
    const rows = await this.db
      .select({ id: user.id, name: user.name, username: user.username, image: user.image })
      .from(user)
      .where(eq(sql`LOWER(${user.username})`, username.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  }

  async findExistingPair(a: string, b: string) {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const rows = await this.db
      .select()
      .from(friendship)
      .where(
        and(
          sql`LEAST(${friendship.requesterId}, ${friendship.recipientId}) = ${lo}`,
          sql`GREATEST(${friendship.requesterId}, ${friendship.recipientId}) = ${hi}`,
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async createRequest(requesterId: string, recipientId: string) {
    const [row] = await this.db
      .insert(friendship)
      .values({ requesterId, recipientId, status: "pending" })
      .returning();
    return row!;
  }

  async getRequest(id: number, recipientId: string) {
    const rows = await this.db
      .select()
      .from(friendship)
      .where(
        and(
          eq(friendship.id, id),
          eq(friendship.recipientId, recipientId),
          eq(friendship.status, "pending"),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async respond(id: number, action: "accept" | "decline") {
    await this.db
      .update(friendship)
      .set({
        status: action === "accept" ? "accepted" : "declined",
        acceptedAt: action === "accept" ? new Date() : null,
      })
      .where(eq(friendship.id, id));
  }

  async listAcceptedFriendsWithUserData(userId: string) {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
      })
      .from(friendship)
      .innerJoin(
        user,
        sql`${user.id} = CASE WHEN ${friendship.requesterId} = ${userId} THEN ${friendship.recipientId} ELSE ${friendship.requesterId} END`,
      )
      .where(
        and(
          or(eq(friendship.requesterId, userId), eq(friendship.recipientId, userId)),
          eq(friendship.status, "accepted"),
        ),
      );
    return rows;
  }

  async listIncomingRequests(userId: string) {
    return this.db
      .select({
        id: friendship.id,
        createdAt: friendship.createdAt,
        from: {
          id: user.id,
          name: user.name,
          username: user.username,
          image: user.image,
        },
      })
      .from(friendship)
      .innerJoin(user, eq(user.id, friendship.requesterId))
      .where(and(eq(friendship.recipientId, userId), eq(friendship.status, "pending")));
  }

  async deletePair(a: string, b: string) {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    await this.db
      .delete(friendship)
      .where(
        and(
          sql`LEAST(${friendship.requesterId}, ${friendship.recipientId}) = ${lo}`,
          sql`GREATEST(${friendship.requesterId}, ${friendship.recipientId}) = ${hi}`,
        ),
      );
  }

  async getWeeklyXp(userId: string, weekStart: Date): Promise<number> {
    const rows = await this.db.execute<{ weekly_xp: number }>(sql`
      SELECT COALESCE(SUM(xp_earned), 0)::int AS weekly_xp
      FROM review_log
      WHERE user_id = ${userId} AND reviewed_at >= ${weekStart}
    `);
    const normalized = Array.isArray(rows) ? rows : (rows as { rows: Array<{ weekly_xp: number }> }).rows;
    return normalized[0]?.weekly_xp ?? 0;
  }

  async findOvertakenFriendIds(
    userId: string,
    weekStart: Date,
    previousWeeklyXp: number,
    newWeeklyXp: number,
  ): Promise<Array<{ friendId: string; weeklyXp: number }>> {
    if (newWeeklyXp <= previousWeeklyXp) return [];
    const result = await this.db.execute<{ friend_id: string; weekly_xp: number }>(sql`
      WITH friends AS (
        SELECT CASE WHEN requester_id = ${userId} THEN recipient_id ELSE requester_id END AS friend_id
        FROM friendship
        WHERE (requester_id = ${userId} OR recipient_id = ${userId}) AND status = 'accepted'
      )
      SELECT f.friend_id, COALESCE(SUM(rl.xp_earned), 0)::int AS weekly_xp
      FROM friends f
      LEFT JOIN review_log rl
        ON rl.user_id = f.friend_id AND rl.reviewed_at >= ${weekStart}
      GROUP BY f.friend_id
      HAVING COALESCE(SUM(rl.xp_earned), 0) >= ${previousWeeklyXp}
         AND COALESCE(SUM(rl.xp_earned), 0) < ${newWeeklyXp}
    `);
    const normalized = Array.isArray(result) ? result : (result as { rows: Array<{ friend_id: string; weekly_xp: number }> }).rows;
    return normalized.map((r) => ({ friendId: r.friend_id, weeklyXp: r.weekly_xp }));
  }
}
