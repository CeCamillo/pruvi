import { z } from "zod";

export const sm2InputSchema = z.object({
  quality: z.number().min(0).max(5),
  repetitions: z.number().min(0),
  easeFactor: z.number().min(1.3),
  interval: z.number().min(0),
});

export type Sm2Input = z.infer<typeof sm2InputSchema>;

export const sm2OutputSchema = z.object({
  repetitions: z.number(),
  easeFactor: z.number(),
  interval: z.number(),
  nextReviewAt: z.string(),
});

export type Sm2Output = z.infer<typeof sm2OutputSchema>;
