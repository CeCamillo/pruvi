import { z } from "zod";

/** POST /sessions/start — request body */
export const StartSessionBodySchema = z.object({
  mode: z.enum(["all", "theoretical"]).default("all"),
});

export type StartSessionBody = z.infer<typeof StartSessionBodySchema>;
