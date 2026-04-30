import { z } from "zod";
import { subjectSchema } from "./subjects";
import { clientQuestionSchema } from "./questions";

/** PUT /roleta/config body. Max 5 because we only seed 5 subjects. */
export const roletaConfigSchema = z.object({
  subjects: z.array(z.string().min(1)).min(1).max(5),
});
export type RoletaConfig = z.infer<typeof roletaConfigSchema>;

/**
 * GET /roleta/config response. `subjects` is always resolved — if the
 * user hasn't configured it yet, the server fills in all 5 subject slugs.
 */
export const roletaConfigResponseSchema = z.object({
  subjects: z.array(z.string()),
});
export type RoletaConfigResponse = z.infer<typeof roletaConfigResponseSchema>;

/**
 * POST /roleta/spin response. `spinId` is a correlation ID the client
 * passes back on each answer; the server does NOT persist it.
 */
export const roletaStartResponseSchema = z.object({
  spinId: z.string().uuid(),
  subject: subjectSchema,
  questions: z.array(clientQuestionSchema).length(3),
});
export type RoletaStartResponse = z.infer<typeof roletaStartResponseSchema>;

/** POST /roleta/answer body. */
export const roletaAnswerBodySchema = z.object({
  spinId: z.string().uuid(),
  questionId: z.number().int(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});
export type RoletaAnswerBody = z.infer<typeof roletaAnswerBodySchema>;

/** POST /roleta/answer response. */
export const roletaAnswerResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number().int(),
  xpAwarded: z.number().int().min(0),
});
export type RoletaAnswerResponse = z.infer<typeof roletaAnswerResponseSchema>;
