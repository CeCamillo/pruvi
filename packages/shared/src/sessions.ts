import { z } from "zod";

/** POST /sessions/start — request body */
export const StartSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]).default("all"),
  topicId: z.number().int().positive().optional(),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;
