import { z } from "zod";
import { MasteryTransitionsSchema } from "./topics";

/** POST /sessions/start — request body */
export const StartSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]).default("all"),
  topicId: z.number().int().positive().optional(),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;

/** POST /sessions/:id/complete — response body */
export const SessionCompleteResponseSchema = z.object({
  session: z.object({
    id: z.number().int(),
    userId: z.string(),
    status: z.enum(["active", "completed"]),
    questionsAnswered: z.number().int().nonnegative().nullable(),
    questionsCorrect: z.number().int().nonnegative().nullable(),
    masterySnapshot: z.record(z.string(), z.string()).nullable(),
    // Fastify serializes Date → ISO string before response-schema validation runs,
    // so the schema MUST be `z.string()` not `z.date()` (see simulados route pattern).
    completedAt: z.string().nullable(),
    createdAt: z.string(),
  }),
  transitions: MasteryTransitionsSchema,
  xpAward: z.object({
    xpAwarded: z.number().int().nonnegative(),
    totalXp: z.number().int().nonnegative(),
    currentLevel: z.number().int().min(1),
    base: z.literal(50),
    correctBonus: z.number().int().nonnegative(),
    streakMultiplier: z.union([z.literal(1), z.literal(1.10)]),
  }).nullable(),
  streakDelta: z.number().int(),
});

export type SessionCompleteResponse = z.infer<typeof SessionCompleteResponseSchema>;
