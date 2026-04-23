import {
  onboardingCompleteBodySchema,
  onboardingCompleteResponseSchema,
  userPreferencesResponseSchema,
  userPreferencesSchema,
  type OnboardingCompleteBody,
  type UserPreferences,
} from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

export const onboardingService = {
  getPreferences: () =>
    apiRequest(
      "/users/me/preferences",
      { method: "GET" },
      userPreferencesResponseSchema,
    ),

  updatePreferences: (patch: UserPreferences) =>
    apiRequest(
      "/users/me/preferences",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPreferencesSchema.parse(patch)),
      },
      userPreferencesResponseSchema,
    ),

  complete: (payload: OnboardingCompleteBody) =>
    apiRequest(
      "/onboarding/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingCompleteBodySchema.parse(payload)),
      },
      onboardingCompleteResponseSchema,
    ),
};
