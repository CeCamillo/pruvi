import { z } from "zod";

export const selectedExamEnum = z.enum([
  "fuvest",
  "unicamp",
  "enem",
  "usp_sp",
  "outras",
]);

export type SelectedExam = z.infer<typeof selectedExamEnum>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/** GET /users/me/preferences — response */
export const PreferencesResponseSchema = z.object({
  selectedExam: selectedExamEnum.nullable(),
  examDate: z.string().nullable(),
  difficulties: z.array(z.string()),
  dailyStudyTimeMinutes: z.number().int().nullable(),
  onboardingCompleted: z.boolean(),
});

export type PreferencesResponse = z.infer<typeof PreferencesResponseSchema>;

/** PUT /users/me/preferences — partial update body */
export const UpdatePreferencesBodySchema = z.object({
  selectedExam: selectedExamEnum.optional(),
  examDate: isoDate.optional(),
  difficulties: z.array(z.string()).optional(),
  dailyStudyTimeMinutes: z.number().int().min(1).max(240).optional(),
});

export type UpdatePreferencesBody = z.infer<typeof UpdatePreferencesBodySchema>;

/** POST /onboarding/complete — body (all required) */
export const CompleteOnboardingBodySchema = z.object({
  selectedExam: selectedExamEnum,
  examDate: isoDate,
  difficulties: z.array(z.string()).min(0),
  dailyStudyTimeMinutes: z.number().int().min(1).max(240),
});

export type CompleteOnboardingBody = z.infer<typeof CompleteOnboardingBodySchema>;
