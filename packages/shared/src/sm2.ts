import { z } from "zod";

export const sm2InputSchema = z.object({
  quality: z.number().min(0).max(5),
  repetitions: z.number().min(0),
  easeFactor: z.number().min(1.3),
  interval: z.number().min(0),
});

export type Sm2Input = z.infer<typeof sm2InputSchema>;

/** Default SM-2 starting state for first-time reviews. */
export const INITIAL_SM2_STATE: Sm2Input = {
  quality: 0,
  repetitions: 0,
  easeFactor: 2.5,
  interval: 0,
};

export const sm2OutputSchema = z.object({
  repetitions: z.number(),
  easeFactor: z.number(),
  interval: z.number(),
  nextReviewAt: z.string(),
});

export type Sm2Output = z.infer<typeof sm2OutputSchema>;

export function calculateSm2(input: Sm2Input): Sm2Output {
  const { quality, repetitions, easeFactor, interval } = input;

  let nextRepetitions: number;
  let nextInterval: number;
  let nextEaseFactor: number;

  if (quality < 3) {
    nextRepetitions = 0;
    nextInterval = 1;
    nextEaseFactor = easeFactor;
  } else {
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * easeFactor);
    }
    nextRepetitions = repetitions + 1;
    nextEaseFactor = Math.max(
      1.3,
      easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
    );
  }

  const nextReviewAt = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000).toISOString();

  return {
    repetitions: nextRepetitions,
    easeFactor: nextEaseFactor,
    interval: nextInterval,
    nextReviewAt,
  };
}
