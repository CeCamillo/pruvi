export type MasteryState =
  | "aprendendo"
  | "entendendo"
  | "afiado"
  | "quase_mestre";

export const MASTERY_THRESHOLDS = {
  entendendo: { minEf: 2.0, minReviews: 5 },
  afiado: { minEf: 2.4, minReviews: 8 },
  quase_mestre: { minEf: 2.8, minReviews: 12 },
} as const;

export function computeMastery(
  efAvg: number | null,
  reviewCount: number,
): MasteryState {
  if (efAvg === null || reviewCount < MASTERY_THRESHOLDS.entendendo.minReviews) {
    return "aprendendo";
  }
  if (
    efAvg >= MASTERY_THRESHOLDS.quase_mestre.minEf &&
    reviewCount >= MASTERY_THRESHOLDS.quase_mestre.minReviews
  ) {
    return "quase_mestre";
  }
  if (
    efAvg >= MASTERY_THRESHOLDS.afiado.minEf &&
    reviewCount >= MASTERY_THRESHOLDS.afiado.minReviews
  ) {
    return "afiado";
  }
  if (efAvg >= MASTERY_THRESHOLDS.entendendo.minEf) {
    return "entendendo";
  }
  return "aprendendo";
}

const RANK: Record<MasteryState, number> = {
  aprendendo: 0,
  entendendo: 1,
  afiado: 2,
  quase_mestre: 3,
};

export function masteryStateRank(state: MasteryState): number {
  return RANK[state];
}
