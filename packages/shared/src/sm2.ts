import { type Result, ok } from "neverthrow";
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

export function calculateSm2(input: Sm2Input): Result<Sm2Output, never> {
  const { quality, repetitions, easeFactor, interval } = input;

  let nextRepetitions: number;
  let nextInterval: number;
  let nextEaseFactor: number;

  if (quality < 3) {
    // Wrong answer: reset progress, ease unchanged
    nextRepetitions = 0;
    nextInterval = 1;
    nextEaseFactor = easeFactor;
  } else {
    // Correct answer: advance interval
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

  return ok({
    repetitions: nextRepetitions,
    easeFactor: nextEaseFactor,
    interval: nextInterval,
    nextReviewAt,
  });
}

/** SM-2 quality score: 0-5 scale used by the algorithm. */
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

/** Initial SM-2 state for a question that has never been reviewed. */
export const INITIAL_SM2_STATE = {
  easinessFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewAt: new Date(0),
} as const;

/** Legacy 2-arg SM-2 API used by reviews.service.ts.
 *  Takes prior state + quality, returns next state. */
export function calculateSM2(
  prev: {
    easinessFactor: number;
    interval: number;
    repetitions: number;
    nextReviewAt: Date;
  },
  quality: QualityScore
): {
  easinessFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
} {
  const result = calculateSm2({
    quality,
    repetitions: prev.repetitions,
    easeFactor: prev.easinessFactor,
    interval: prev.interval,
  });
  if (result.isErr()) throw result.error;
  const out = result.value;
  return {
    easinessFactor: out.easeFactor,
    interval: out.interval,
    repetitions: out.repetitions,
    nextReviewAt: new Date(out.nextReviewAt),
  };
}
