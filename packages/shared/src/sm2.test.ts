import { describe, it, expect } from "vitest";
import { SM2StateSchema, INITIAL_SM2_STATE, calculateSM2, type SM2State } from "./sm2";

describe("SM2StateSchema", () => {
  it("accepts the initial state", () => {
    const result = SM2StateSchema.safeParse(INITIAL_SM2_STATE);
    expect(result.success).toBe(true);
  });

  it("rejects easinessFactor below 1.3", () => {
    const result = SM2StateSchema.safeParse({
      ...INITIAL_SM2_STATE,
      easinessFactor: 1.2,
    });
    expect(result.success).toBe(false);
  });
});

const BASE_STATE: SM2State = {
  easinessFactor: 2.5,
  interval: 1,
  repetitions: 0,
  nextReviewAt: new Date(),
};

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("calculateSM2 — failures (quality < 3)", () => {
  it("quality 0: resets reps/interval, EF=1.70", () => {
    const result = calculateSM2(BASE_STATE, 0, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(1.7, 10);
  });

  it("quality 1: resets reps/interval, EF=1.96", () => {
    const result = calculateSM2(BASE_STATE, 1, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(1.96, 10);
  });

  it("quality 2: resets reps/interval, EF=2.18", () => {
    const result = calculateSM2(BASE_STATE, 2, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.18, 10);
  });

  it("quality 2 from EF=1.6: EF hits floor at 1.3", () => {
    const state = { ...BASE_STATE, easinessFactor: 1.6 };
    const result = calculateSM2(state, 2, NOW);
    expect(result.easinessFactor).toBe(1.3);
  });
});

describe("calculateSM2 — successes (quality >= 3)", () => {
  it("quality 3, rep=0: rep=1, interval=1, EF=2.36", () => {
    const result = calculateSM2(BASE_STATE, 3, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.36, 10);
  });

  it("quality 4, rep=0: rep=1, interval=1, EF unchanged at 2.5", () => {
    const result = calculateSM2(BASE_STATE, 4, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.5, 10);
  });

  it("quality 5, rep=0: rep=1, interval=1, EF=2.6", () => {
    const result = calculateSM2(BASE_STATE, 5, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.6, 10);
  });

  it("second review (rep=1, q=5): rep=2, interval=6", () => {
    const state = { ...BASE_STATE, repetitions: 1, interval: 1 };
    const result = calculateSM2(state, 5, NOW);
    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  it("third review (rep=2, interval=6, EF=2.5, q=5): interval=floor(6*2.6)=15", () => {
    const state = { ...BASE_STATE, repetitions: 2, interval: 6 };
    const result = calculateSM2(state, 5, NOW);
    expect(result.interval).toBe(15); // floor(6 * 2.6) = floor(15.6)
  });

  it("third review (rep=2, interval=6, EF=2.5, q=3): interval=floor(6*2.36)=14", () => {
    const state = { ...BASE_STATE, repetitions: 2, interval: 6 };
    const result = calculateSM2(state, 3, NOW);
    expect(result.interval).toBe(14); // floor(6 * 2.36) = floor(14.16)
  });
});

describe("calculateSM2 — nextReviewAt", () => {
  it("nextReviewAt is exactly now + interval * 86400000ms", () => {
    const result = calculateSM2(BASE_STATE, 5, NOW);
    expect(result.nextReviewAt.getTime()).toBe(
      NOW.getTime() + result.interval * 86_400_000
    );
  });
});

describe("calculateSM2 — reset-then-succeed sequence", () => {
  it("after a failure, interval restarts from 1, not previous high", () => {
    // First pass: rep 0 → 1, interval = 1
    const afterFirstPass = calculateSM2(BASE_STATE, 5, NOW);
    expect(afterFirstPass.repetitions).toBe(1);
    expect(afterFirstPass.interval).toBe(1);

    // Second pass: rep 1 → 2, interval = 6
    const afterSecondPass = calculateSM2(afterFirstPass, 5, NOW);
    expect(afterSecondPass.interval).toBe(6);

    // Failure: rep resets to 0, interval resets to 1
    const afterFailure = calculateSM2(afterSecondPass, 0, NOW);
    expect(afterFailure.repetitions).toBe(0);
    expect(afterFailure.interval).toBe(1);

    // Pass again: interval should be 1 (rep was 0), not 6
    const afterRecovery = calculateSM2(afterFailure, 5, NOW);
    expect(afterRecovery.repetitions).toBe(1);
    expect(afterRecovery.interval).toBe(1);
  });
});
