import { sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

export interface RawRankingRow extends Record<string, unknown> {
  user_id: string;
  name: string;
  username: string | null;
  image: string | null;
  weekly_xp: number;
}

export class RankingRepository {
  constructor(private db: Db) {}

  async getFriendsRanking(userId: string, weekStart: Date): Promise<RawRankingRow[]> {
    const result = await this.db.execute<RawRankingRow>(sql`
      WITH friends AS (
        SELECT CASE WHEN requester_id = ${userId} THEN recipient_id ELSE requester_id END AS friend_id
        FROM friendship
        WHERE (requester_id = ${userId} OR recipient_id = ${userId}) AND status = 'accepted'
      )
      SELECT
        u.id AS user_id, u.name, u.username, u.image,
        COALESCE(SUM(rl.xp_earned), 0)::int AS weekly_xp
      FROM "user" u
      LEFT JOIN review_log rl
        ON rl.user_id = u.id AND rl.reviewed_at >= ${weekStart}
      WHERE u.id = ${userId} OR u.id IN (SELECT friend_id FROM friends)
      GROUP BY u.id, u.name, u.username, u.image
      ORDER BY weekly_xp DESC, u.id ASC
    `);
    // Drizzle's execute() returns shape per driver: { rows: [...] } on pg, Array on PGlite.
    // Normalize:
    return Array.isArray(result) ? result : (result as { rows: RawRankingRow[] }).rows;
  }
}
