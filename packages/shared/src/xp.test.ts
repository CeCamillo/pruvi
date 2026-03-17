import { describe, it, expect } from "vitest";
import {
  calculateXpForAnswer,
  getLevelForXp,
  xpForNextLevel,
  XP_PER_DIFFICULTY,
  LEVEL_THRESHOLDS,
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
