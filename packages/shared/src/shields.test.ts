import { describe, expect, it } from "vitest";
import { ShieldBalanceResponseSchema, ShieldUseResultSchema, MAX_STREAK_SHIELDS, todayInBrt } from "./shields";

describe("ShieldBalanceResponseSchema", () => {
  it("accepts a valid balance at cap", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 1, maxAvailable: 1, nextRefillAt: null,
    }).success).toBe(true);
  });
  it("accepts a zero balance with nextRefillAt", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 0, maxAvailable: 1, nextRefillAt: "2026-06-12T00:00:00.000Z",
    }).success).toBe(true);
  });
  it("rejects available > MAX_STREAK_SHIELDS", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: 2, maxAvailable: 1, nextRefillAt: null,
    }).success).toBe(false);
  });
  it("rejects negative available", () => {
    expect(ShieldBalanceResponseSchema.safeParse({
      available: -1, maxAvailable: 1, nextRefillAt: null,
    }).success).toBe(false);
  });
  it("MAX_STREAK_SHIELDS = 1", () => {
    expect(MAX_STREAK_SHIELDS).toBe(1);
  });
});

describe("ShieldUseResultSchema", () => {
  it("accepts used=true with numeric balanceAfter", () => {
    expect(ShieldUseResultSchema.safeParse({ used: true, balanceAfter: 0 }).success).toBe(true);
  });
  it("accepts used=false with null balanceAfter", () => {
    expect(ShieldUseResultSchema.safeParse({ used: false, balanceAfter: null }).success).toBe(true);
  });
});

describe("todayInBrt", () => {
  it("returns BRT date for noon UTC (=09:00 BRT)", () => {
    expect(todayInBrt(new Date("2026-05-12T12:00:00Z"))).toBe("2026-05-12");
  });
  it("returns previous day when UTC has rolled over but BRT has not", () => {
    // 2026-05-13 02:00 UTC = 2026-05-12 23:00 BRT
    expect(todayInBrt(new Date("2026-05-13T02:00:00Z"))).toBe("2026-05-12");
  });
  it("returns same day at BRT midnight boundary", () => {
    // 2026-05-12 03:00 UTC = 2026-05-12 00:00 BRT
    expect(todayInBrt(new Date("2026-05-12T03:00:00Z"))).toBe("2026-05-12");
  });
});
