import { describe, expect, it } from "vitest";
import { ShieldBalanceResponseSchema, MAX_STREAK_SHIELDS } from "./shields";

describe("ShieldBalanceResponseSchema", () => {
  it("accepts a valid balance", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 2, maxAvailable: 3, nextRefillAt: "2026-06-12T00:00:00.000Z",
    }).success).toBe(true);
  });
  it("accepts null nextRefillAt", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 0, maxAvailable: 3, nextRefillAt: null,
    }).success).toBe(true);
  });
  it("rejects available > MAX_STREAK_SHIELDS", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 4, maxAvailable: 3, nextRefillAt: null,
    }).success).toBe(false);
  });
  it("rejects negative available", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: -1, maxAvailable: 3, nextRefillAt: null,
    }).success).toBe(false);
  });
  it("MAX_STREAK_SHIELDS = 3", () => {
    expect(MAX_STREAK_SHIELDS).toBe(3);
  });
});
