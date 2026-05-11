import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export type PrefsRow = {
  notificationHour: number;
  streakRemindersEnabled: boolean;
  achievementNotificationsEnabled: boolean;
};

export type PrefsPatch = Partial<PrefsRow>;

export class PreferencesRepository {
  constructor(private db: DbClient) {}

  async get(userId: string): Promise<PrefsRow | null> {
    const [row] = await this.db
      .select({
        notificationHour: user.notificationHour,
        streakRemindersEnabled: user.streakRemindersEnabled,
        achievementNotificationsEnabled: user.achievementNotificationsEnabled,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }

  async update(userId: string, patch: PrefsPatch): Promise<PrefsRow | null> {
    const [row] = await this.db
      .update(user)
      .set(patch)
      .where(eq(user.id, userId))
      .returning({
        notificationHour: user.notificationHour,
        streakRemindersEnabled: user.streakRemindersEnabled,
        achievementNotificationsEnabled: user.achievementNotificationsEnabled,
      });
    return row ?? null;
  }
}
