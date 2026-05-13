import { describe, it, expect } from "vitest";
import {
  calculateXpForAnswer,
  getLevelForXp,
  xpForNextLevel,
  XP_PER_DIFFICULTY,
  LEVEL_THRESHOLDS,
  calculateSessionCompletionXp,
} from "./xp";

describe("calculateXpForAnswer", () => {
  it("returns 0 XP for wrong answer", () => {
    expect(calculateXpForAnswer(false, "easy")).toBe(0);
    expect(calculateXpForAnswer(false, "hard")).toBe(0);
  });

  it("returns difficulty-scaled XP for correct answer", () => {
    expect(calculateXpForAnswer(true, "easy")).toBe(XP_PER_DIFFICULTY.easy);
    expect(calculateXpForAnswer(true, "medium")).toBe(XP_PER_DIFFICULTY.medium);
    expect(calculateXpForAnswer(true, "hard")).toBe(XP_PER_DIFFICULTY.hard);
  });
});

describe("getLevelForXp", () => {
  it("returns level 1 for 0 XP", () => {
    expect(getLevelForXp(0)).toBe(1);
  });

  it("returns level 2 at 100 XP", () => {
    expect(getLevelForXp(100)).toBe(2);
  });

  it("returns level 3 at 350 XP", () => {
    expect(getLevelForXp(350)).toBe(3);
  });

  it("returns correct level for XP between thresholds", () => {
    expect(getLevelForXp(50)).toBe(1);
    expect(getLevelForXp(200)).toBe(2);
  });

  it("caps at max level for very high XP", () => {
    const maxLevel = LEVEL_THRESHOLDS.length + 1;
    expect(getLevelForXp(999999)).toBe(maxLevel);
  });
});

describe("xpForNextLevel", () => {
  it("returns 100 for 0 XP (need 100 for level 2)", () => {
    expect(xpForNextLevel(0)).toBe(100);
  });

  it("returns 250 for 100 XP (need 350 for level 3)", () => {
    expect(xpForNextLevel(100)).toBe(250);
  });

  it("returns 0 at max level", () => {
    expect(xpForNextLevel(999999)).toBe(0);
  });
});

describe("calculateSessionCompletionXp", () => {
  it("0 correct, streak=0 → base 50, no bonus, multiplier 1, total 50", () => {
    expect(calculateSessionCompletionXp(0, 0)).toEqual({
      base: 50,
      correctBonus: 0,
      streakMultiplier: 1,
      total: 50,
    });
  });

  it("8 correct, streak=3 → total 90", () => {
    const result = calculateSessionCompletionXp(8, 3);
    expect(result.total).toBe(90); // (50 + 40) * 1 = 90
  });

  it("10 correct, streak=7 → total 100 (boundary: multiplier NOT applied at 7)", () => {
    const result = calculateSessionCompletionXp(10, 7);
    expect(result.streakMultiplier).toBe(1);
    expect(result.total).toBe(100); // (50 + 50) * 1 = 100
  });

  it("10 correct, streak=8 → total 110 (multiplier applied above 7)", () => {
    const result = calculateSessionCompletionXp(10, 8);
    expect(result.streakMultiplier).toBe(1.10);
    expect(result.total).toBe(110); // floor((50 + 50) * 1.1) = 110
  });

  it("7 correct, streak=10 → total 93 (floor applied)", () => {
    const result = calculateSessionCompletionXp(7, 10);
    expect(result.streakMultiplier).toBe(1.10);
    expect(result.total).toBe(93); // floor((50 + 35) * 1.1) = floor(93.5) = 93
  });

  it("negative questionsCorrect treated as 0 (defensive) → total 50", () => {
    const result = calculateSessionCompletionXp(-5, 0);
    expect(result.correctBonus).toBe(0);
    expect(result.total).toBe(50);
  });
});
