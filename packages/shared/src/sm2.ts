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
