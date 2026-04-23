import { err, ok, type Result } from "neverthrow";
import type {
  OnboardingCompleteBody,
  UserPreferences,
  UserPreferencesResponse,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError } from "../../utils/errors";
import type { OnboardingRepository } from "./onboarding.repository";

export class OnboardingService {
  constructor(private repo: OnboardingRepository) {}

  async getPreferences(
    userId: string
  ): Promise<Result<UserPreferencesResponse, AppError>> {
    const row = await this.repo.getPreferences(userId);
    if (!row) {
      return err(new NotFoundError("User not found"));
    }
    return ok(row);
  }

  /** Partial preference update — any subset of fields is allowed. */
  async updatePreferences(
    userId: string,
    patch: UserPreferences
  ): Promise<Result<UserPreferencesResponse, AppError>> {
    await this.repo.updatePreferences(userId, patch);
    const row = await this.repo.getPreferences(userId);
    if (!row) {
      return err(new NotFoundError("User not found"));
    }
    return ok(row);
  }

  /**
   * Persists the full onboarding answer set and flips `onboardingCompleted`.
   * Callers must have validated the payload already (via zod).
   */
  async completeOnboarding(
    userId: string,
    payload: OnboardingCompleteBody
  ): Promise<Result<{ onboardingCompleted: true }, AppError>> {
    await this.repo.completeOnboarding(userId, payload);
    return ok({ onboardingCompleted: true });
  }
}
