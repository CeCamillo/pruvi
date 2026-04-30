import { z } from "zod";

/**
 * Allowed enum values are kept as string literals here (not the DB). The schema
 * table columns are plain `text` to avoid Postgres enum migrations; validation
 * lives at the API boundary via Zod.
 */

export const examOptions = ["enem", "fuvest", "unicamp", "other"] as const;
export const examSchema = z.enum(examOptions);
export type Exam = z.infer<typeof examSchema>;

export const prepTimelineOptions = ["3m", "3-6m", "6-12m", "preparing"] as const;
export const prepTimelineSchema = z.enum(prepTimelineOptions);
export type PrepTimeline = z.infer<typeof prepTimelineSchema>;

export const studyDifficultyOptions = [
  "consistency",
  "easy-errors",
  "review",
  "where-start",
  "time-mgmt",
] as const;
export const studyDifficultySchema = z.enum(studyDifficultyOptions);
export type StudyDifficulty = z.infer<typeof studyDifficultySchema>;

/** @deprecated Replaced by dailyGoalMinutes (integer). Kept for native app backward compat during migration. */
export const dailyStudyTimeOptions = ["30min", "1h", "2h", "3h+"] as const;
/** @deprecated Replaced by dailyGoalMinutes (integer). Kept for native app backward compat during migration. */
export const dailyStudyTimeSchema = z.enum(dailyStudyTimeOptions);
/** @deprecated Replaced by dailyGoalMinutes (integer). Kept for native app backward compat during migration. */
export type DailyStudyTime = z.infer<typeof dailyStudyTimeSchema>;

/** PUT /users/me/preferences — partial update. */
export const userPreferencesSchema = z.object({
  selectedExam: examSchema.optional(),
  prepTimeline: prepTimelineSchema.optional(),
  difficulties: z.array(studyDifficultySchema).max(5).optional(),
  dailyGoalMinutes: z.number().int().min(30).max(180).nullable().optional(),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

/** Preferences as returned from the server (nullable until the user picks). */
export const userPreferencesResponseSchema = z.object({
  selectedExam: examSchema.nullable(),
  prepTimeline: prepTimelineSchema.nullable(),
  difficulties: z.array(studyDifficultySchema).nullable(),
  dailyGoalMinutes: z.number().int().min(30).max(180).nullable(),
  onboardingCompleted: z.boolean(),
});
export type UserPreferencesResponse = z.infer<
  typeof userPreferencesResponseSchema
>;

/** POST /onboarding/complete — commits the preferences + flips the flag. */
export const onboardingCompleteBodySchema = z.object({
  selectedExam: examSchema,
  prepTimeline: prepTimelineSchema,
  difficulties: z.array(studyDifficultySchema).min(1).max(5),
  dailyGoalMinutes: z.number().int().min(30).max(180),
});
export type OnboardingCompleteBody = z.infer<
  typeof onboardingCompleteBodySchema
>;

export const onboardingCompleteResponseSchema = z.object({
  onboardingCompleted: z.literal(true),
});
export type OnboardingCompleteResponse = z.infer<
  typeof onboardingCompleteResponseSchema
>;
