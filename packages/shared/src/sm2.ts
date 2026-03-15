import { z } from "zod";

export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface SM2State {
  easinessFactor: number; // starts at 2.5, never < 1.3
  interval: number; // days until next review; 0 = not yet scheduled
  repetitions: number; // consecutive correct reviews
  nextReviewAt: Date; // absolute date of next review
}

export const SM2StateSchema = z.object({
  easinessFactor: z.number().min(1.3),
  interval: z.number().int().min(0),
  repetitions: z.number().int().min(0),
  nextReviewAt: z.coerce.date(),
});

export const INITIAL_SM2_STATE: SM2State = {
  easinessFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewAt: new Date(), // overwritten on first review
};

function updateEF(ef: number, quality: QualityScore): number {
  const newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return Math.max(1.3, newEF);
}

export function calculateSM2(
  state: SM2State,
  quality: QualityScore,
  now: Date = new Date()
): SM2State {
  const newEF = updateEF(state.easinessFactor, quality);

  let newRepetitions: number;
  let newInterval: number;

  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1;
  } else if (state.repetitions === 0) {
    newRepetitions = 1;
    newInterval = 1;
  } else if (state.repetitions === 1) {
    newRepetitions = 2;
    newInterval = 6;
  } else {
    newRepetitions = state.repetitions + 1;
    newInterval = Math.floor(state.interval * newEF);
  }

  return {
    easinessFactor: newEF,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewAt: new Date(now.getTime() + newInterval * 86_400_000),
  };
}
