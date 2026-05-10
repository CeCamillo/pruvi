import { err, ok, type Result } from "neverthrow";
import { NotFoundError, ValidationError, AppError } from "../../utils/errors";
import type { OnboardingRepository } from "./onboarding.repository";

type Prefs = NonNullable<Awaited<ReturnType<OnboardingRepository["getPreferences"]>>>;

export class OnboardingService {
  constructor(private repo: OnboardingRepository) {}

  async getPreferences(userId: string): Promise<Result<Prefs, AppError>> {
    const prefs = await this.repo.getPreferences(userId);
    if (!prefs) {
      return err(new NotFoundError("User not found"));
    }
    return ok(prefs);
  }

  async updatePreferences(
    userId: string,
    patch: {
      selectedExam?: "fuvest" | "unicamp" | "enem" | "usp_sp" | "outras";
      examDate?: string;
      difficulties?: string[];
      dailyStudyTimeMinutes?: number;
    }
  ): Promise<Result<Prefs, AppError>> {
    if (patch.difficulties) {
      const allowed = new Set(await this.repo.listSubjectSlugs());
      const invalid = patch.difficulties.filter((slug) => !allowed.has(slug));
      if (invalid.length > 0) {
        return err(
          new ValidationError(`Unknown subject slug(s): ${invalid.join(", ")}`)
        );
      }
    }
    const updated = await this.repo.updatePreferences(userId, patch);
    if (!updated) {
      return err(new NotFoundError("User not found"));
    }
    return ok(updated);
  }

  async completeOnboarding(
    userId: string,
    payload: {
      selectedExam: "fuvest" | "unicamp" | "enem" | "usp_sp" | "outras";
      examDate: string;
      difficulties: string[];
      dailyStudyTimeMinutes: number;
    }
  ): Promise<Result<Prefs, AppError>> {
    const existing = await this.repo.getPreferences(userId);
    if (!existing) {
      return err(new NotFoundError("User not found"));
    }
    if (existing.onboardingCompleted) {
      return err(
        new AppError(
          "Onboarding already completed",
          409,
          "ONBOARDING_ALREADY_COMPLETED"
        )
      );
    }
    const allowed = new Set(await this.repo.listSubjectSlugs());
    const invalid = payload.difficulties.filter((slug) => !allowed.has(slug));
    if (invalid.length > 0) {
      return err(
        new ValidationError(`Unknown subject slug(s): ${invalid.join(", ")}`)
      );
    }
    const completed = await this.repo.completeOnboarding(userId, payload);
    if (!completed) {
      return err(new NotFoundError("User not found"));
    }
    return ok(completed);
  }
}
