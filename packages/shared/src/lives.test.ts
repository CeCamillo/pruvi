import { describe, expect, it } from "vitest";
import {
  computeRegenSnapshot,
  nextRegenAt,
  LIVES_REGEN_INTERVAL_MS,
  MAX_LIVES,
} from "./lives";

const FOUR_H = LIVES_REGEN_INTERVAL_MS;
const base = new Date("2026-05-11T12:00:00Z");

describe("computeRegenSnapshot", () => {
  it("returns as-is when already at MAX_LIVES (anchor null)", () => {
    const r = computeRegenSnapshot(MAX_LIVES, null, base);
    expect(r).toEqual({ lives: MAX_LIVES, lastRegenAt: null, regenerated: 0 });
  });

  it("treats null anchor + sub-max lives as fresh anchor (defensive)", () => {
    const r = computeRegenSnapshot(2, null, base);
    expect(r.lives).toBe(2);
    expect(r.lastRegenAt).toEqual(base);
    expect(r.regenerated).toBe(0);
  });

  it("regenerates +1 after one interval", () => {
    const anchor = new Date(base.getTime() - FOUR_H);
    const r = computeRegenSnapshot(2, anchor, base);
    expect(r.lives).toBe(3);
    expect(r.regenerated).toBe(1);
    expect(r.lastRegenAt).toEqual(base);
  });

  it("regenerates multiple ticks at once", () => {
    const anchor = new Date(base.getTime() - 3 * FOUR_H);
    const r = computeRegenSnapshot(1, anchor, base);
    expect(r.lives).toBe(4);
    expect(r.regenerated).toBe(3);
    expect(r.lastRegenAt).toEqual(new Date(anchor.getTime() + 3 * FOUR_H));
  });

  it("caps at MAX_LIVES and nulls anchor when full regen reached", () => {
    const anchor = new Date(base.getTime() - 100 * FOUR_H);
    const r = computeRegenSnapshot(0, anchor, base);
    expect(r.lives).toBe(MAX_LIVES);
    expect(r.lastRegenAt).toBeNull();
    expect(r.regenerated).toBe(MAX_LIVES);
  });

  it("does not regen when elapsed < interval", () => {
    const anchor = new Date(base.getTime() - (FOUR_H - 1));
    const r = computeRegenSnapshot(2, anchor, base);
    expect(r.lives).toBe(2);
    expect(r.regenerated).toBe(0);
    expect(r.lastRegenAt).toEqual(anchor);
  });

  it("handles negative elapsed (clock skew) without going backwards", () => {
    const future = new Date(base.getTime() + FOUR_H);
    const r = computeRegenSnapshot(3, future, base);
    expect(r.lives).toBe(3);
    expect(r.regenerated).toBe(0);
  });
});

describe("nextRegenAt", () => {
  it("returns null when at MAX_LIVES", () => {
    expect(nextRegenAt(MAX_LIVES, null)).toBeNull();
  });

  it("returns anchor + interval when below MAX_LIVES", () => {
    const anchor = new Date(base.getTime() - 1000);
    const result = nextRegenAt(3, anchor);
    expect(result).toEqual(new Date(anchor.getTime() + FOUR_H));
  });

  it("returns null when below MAX_LIVES but anchor is null (defensive)", () => {
    expect(nextRegenAt(2, null)).toBeNull();
  });
});
