import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";
import type {
  DailyStudyTime,
  Exam,
  PrepTimeline,
  StudyDifficulty,
} from "@pruvi/shared";

type DbClient = typeof db;

export type PreferencesRow = {
  selectedExam: Exam | null;
  prepTimeline: PrepTimeline | null;
  difficulties: StudyDifficulty[] | null;
  dailyStudyTime: DailyStudyTime | null;
  onboardingCompleted: boolean;
};

export type PreferencesPatch = {
  selectedExam?: Exam;
  prepTimeline?: PrepTimeline;
  difficulties?: StudyDifficulty[];
  dailyStudyTime?: DailyStudyTime;
};

export class OnboardingRepository {
  constructor(private db: DbClient) {}

  async getPreferences(userId: string): Promise<PreferencesRow | null> {
    const rows = await this.db
      .select({
        selectedExam: user.selectedExam,
        prepTimeline: user.prepTimeline,
        difficulties: user.difficulties,
        dailyStudyTime: user.dailyStudyTime,
        onboardingCompleted: user.onboardingCompleted,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return row as PreferencesRow;
  }

  async updatePreferences(
    userId: string,
    patch: PreferencesPatch
  ): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(user).set(patch).where(eq(user.id, userId));
  }

  async completeOnboarding(
    userId: string,
    patch: Required<PreferencesPatch>
  ): Promise<void> {
    await this.db
      .update(user)
      .set({ ...patch, onboardingCompleted: true })
      .where(eq(user.id, userId));
  }
}
