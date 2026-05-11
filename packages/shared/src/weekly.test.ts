import { describe, expect, it } from "vitest";
import { startOfWeekBrt } from "./weekly";

describe("startOfWeekBrt", () => {
  it("noon BRT Wednesday → Monday 00:00 BRT", () => {
    // 2026-05-13 15:00:00Z = 2026-05-13 12:00:00 BRT (Wed)
    const input = new Date("2026-05-13T15:00:00Z");
    const r = startOfWeekBrt(input);
    // Monday 2026-05-11 00:00:00 BRT = 2026-05-11 03:00:00Z
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Monday 00:30 BRT → Monday 00:00 BRT (same day)", () => {
    const input = new Date("2026-05-11T03:30:00Z"); // 00:30 BRT
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Monday 23:00 UTC (still Mon 20:00 BRT) → Monday 00:00 BRT", () => {
    const input = new Date("2026-05-11T23:00:00Z");
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Sunday 23:00 BRT → previous Monday", () => {
    // 2026-05-17 23:00 BRT = 2026-05-18 02:00 UTC
    const input = new Date("2026-05-18T02:00:00Z");
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Monday 02:00 UTC (Sunday 23:00 BRT) → previous Monday", () => {
    const input = new Date("2026-05-11T02:00:00Z"); // 23:00 BRT Sun
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-04T03:00:00.000Z");
  });
});
