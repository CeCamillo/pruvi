import { describe, expect, it } from "vitest";
import { calculateSm2 } from "../sm2";

const BASE = { repetitions: 0, easeFactor: 2.5, interval: 0 };

describe("calculateSm2", () => {
  it("first correct answer (q=3) → interval=1, repetitions=1", () => {
    const result = calculateSm2({ ...BASE, quality: 3 });
    expect(result.isOk()).toBe(true);
    const out = result._unsafeUnwrap();
    expect(out.interval).toBe(1);
    expect(out.repetitions).toBe(1);
  });

  it("first correct answer (q=5) → higher easeFactor than q=3", () => {
    const q5 = calculateSm2({ ...BASE, quality: 5 })._unsafeUnwrap();
    const q3 = calculateSm2({ ...BASE, quality: 3 })._unsafeUnwrap();
    expect(q5.easeFactor).toBeGreaterThan(q3.easeFactor);
  });

  it("second correct answer (q=4) → interval=6, repetitions=2", () => {
    const first = calculateSm2({ ...BASE, quality: 4 })._unsafeUnwrap();
    const second = calculateSm2({ ...first, quality: 4 })._unsafeUnwrap();
    expect(second.interval).toBe(6);
    expect(second.repetitions).toBe(2);
  });

  it("third correct answer → interval = round(6 * easeFactor), repetitions=3", () => {
    const first = calculateSm2({ ...BASE, quality: 4 })._unsafeUnwrap();
    const second = calculateSm2({ ...first, quality: 4 })._unsafeUnwrap();
    const third = calculateSm2({ ...second, quality: 4 })._unsafeUnwrap();
    expect(third.interval).toBe(Math.round(6 * second.easeFactor));
    expect(third.repetitions).toBe(3);
  });

  it("wrong answer (q=0) → resets: repetitions=0, interval=1", () => {
    // Start from a state with some progress
    const progressed = calculateSm2({ ...BASE, quality: 5 })._unsafeUnwrap();
    const result = calculateSm2({ ...progressed, quality: 0 })._unsafeUnwrap();
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  it("wrong answer (q=2) → resets but keeps prior easeFactor unchanged", () => {
    const prior = calculateSm2({ ...BASE, quality: 5 })._unsafeUnwrap();
    const result = calculateSm2({ ...prior, quality: 2 })._unsafeUnwrap();
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(prior.easeFactor);
  });

  it("ease floor: quality=0 repeated → easeFactor never drops below 1.3", () => {
    let state = { ...BASE };
    for (let i = 0; i < 10; i++) {
      state = calculateSm2({ ...state, quality: 0 })._unsafeUnwrap();
      expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
    }
  });

  it("nextReviewAt is a valid future ISO date string when interval > 0", () => {
    const out = calculateSm2({ ...BASE, quality: 3 })._unsafeUnwrap();
    expect(out.interval).toBeGreaterThan(0);
    const date = new Date(out.nextReviewAt);
    expect(Number.isNaN(date.getTime())).toBe(false);
    expect(date.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("multiple cycles: ease grows over consecutive correct answers (q=5)", () => {
    let state = { ...BASE };
    const easeValues: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = calculateSm2({ ...state, quality: 5 })._unsafeUnwrap();
      easeValues.push(state.easeFactor);
    }
    // Each q=5 answer adds +0.1 ease
    for (let i = 1; i < easeValues.length; i++) {
      expect(easeValues[i]).toBeGreaterThan(easeValues.at(i - 1));
    }
  });
});
