import { sql } from "drizzle-orm";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class SweepRepository {
  constructor(private db: DbClient) {}

  async findEligibleForStreakReminder(brtHour: number): Promise<Array<{ userId: string; token: string }>> {
    const result = await this.db.execute(sql`
      SELECT u.id AS user_id, pt.token AS token
      FROM "user" u
      JOIN "push_token" pt ON pt.user_id = u.id
      WHERE u.streak_reminders_enabled = TRUE
        AND u.notification_hour = ${brtHour}
        AND NOT EXISTS (
          SELECT 1 FROM "daily_session" ds
          WHERE ds.user_id = u.id
            AND ds.status = 'completed'
            AND (ds.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        )
    `);
    // pg returns { rows: [...] }; PGlite returns the array directly. Handle both.
    const rows: Array<{ user_id: string; token: string }> = Array.isArray(result)
      ? (result as unknown as Array<{ user_id: string; token: string }>)
      : (result as unknown as { rows: Array<{ user_id: string; token: string }> }).rows;
    return rows.map((r) => ({ userId: r.user_id, token: r.token }));
  }
}
