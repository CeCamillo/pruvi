import { z } from "zod";
import { QuestionModeSchema, QuestionSchema } from "./questions";

/** POST /sessions/start — request body */
export const StartSessionBodySchema = z.object({
  mode: QuestionModeSchema.default("all"),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;

/** Session as returned to the client */
export const SessionSchema = z.object({
  id: z.number().int().positive(),
  userId: z.string().max(100),
  status: z.enum(["active", "completed"]),
  questionCount: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type Session = z.infer<typeof SessionSchema>;

/** POST /sessions/start — response */
export const StartSessionResponseSchema = z.object({
  session: SessionSchema,
  questions: z.array(QuestionSchema),
});

export type StartSessionResponse = z.infer<typeof StartSessionResponseSchema>;

/** POST /sessions/:id/complete — response */
export const CompleteSessionResponseSchema = z.object({
  session: SessionSchema,
  streak: z.number().int(),
});

export type CompleteSessionResponse = z.infer<
  typeof CompleteSessionResponseSchema
>;

/** GET /sessions/today — response (nullable if no session today) */
export const TodaySessionResponseSchema = z.object({
  session: SessionSchema.nullable(),
});

export type TodaySessionResponse = z.infer<typeof TodaySessionResponseSchema>;
