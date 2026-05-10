import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class OnboardingRepository {
  constructor(private db: DbClient) {}

  async getPreferences(userId: string) {
    const rows = await this.db
      .select({
        selectedExam: user.selectedExam,
        examDate: user.examDate,
        difficulties: user.difficulties,
        dailyStudyTimeMinutes: user.dailyStudyTimeMinutes,
        onboardingCompleted: user.onboardingCompleted,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async updatePreferences(
    userId: string,
    patch: Partial<{
      selectedExam: "fuvest" | "unicamp" | "enem" | "usp_sp" | "outras";
      examDate: string;
      difficulties: string[];
      dailyStudyTimeMinutes: number;
    }>
  ) {
    const [row] = await this.db
      .update(user)
      .set(patch)
      .where(eq(user.id, userId))
      .returning({
        selectedExam: user.selectedExam,
        examDate: user.examDate,
        difficulties: user.difficulties,
        dailyStudyTimeMinutes: user.dailyStudyTimeMinutes,
        onboardingCompleted: user.onboardingCompleted,
      });
    return row;
  }

  async completeOnboarding(
    userId: string,
    payload: {
      selectedExam: "fuvest" | "unicamp" | "enem" | "usp_sp" | "outras";
      examDate: string;
      difficulties: string[];
      dailyStudyTimeMinutes: number;
    }
  ) {
    const [row] = await this.db
      .update(user)
      .set({ ...payload, onboardingCompleted: true })
      .where(eq(user.id, userId))
      .returning({
        selectedExam: user.selectedExam,
        examDate: user.examDate,
        difficulties: user.difficulties,
        dailyStudyTimeMinutes: user.dailyStudyTimeMinutes,
        onboardingCompleted: user.onboardingCompleted,
      });
    return row;
  }

  async listSubjectSlugs(): Promise<string[]> {
    const rows = await this.db.select({ slug: subject.slug }).from(subject);
    return rows.map((r) => r.slug);
  }
}
