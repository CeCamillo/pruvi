import { describe, it, expect, vi, afterEach } from "vitest";
import { formatMonth, isFutureMonth, monthBoundaries } from "./month-utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatMonth", () => {
  it("formats a Date to YYYY-MM", () => {
    expect(formatMonth(new Date(2026, 3, 16))).toBe("2026-04");
    expect(formatMonth(new Date(2026, 0, 1))).toBe("2026-01");
    expect(formatMonth(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("isFutureMonth", () => {
  it("returns false for current month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    expect(isFutureMonth("2026-04")).toBe(false);
  });

  it("returns false for past month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    expect(isFutureMonth("2025-12")).toBe(false);
    expect(isFutureMonth("2026-03")).toBe(false);
  });

  it("returns true for future month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 16));
    expect(isFutureMonth("2026-05")).toBe(true);
    expect(isFutureMonth("2027-01")).toBe(true);
  });
});

describe("monthBoundaries", () => {
  it("returns inclusive start and exclusive end YYYY-MM-DD strings", () => {
    expect(monthBoundaries("2026-04")).toEqual({
      start: "2026-04-01",
      end: "2026-05-01",
    });
  });

  it("handles year rollover (December → next January)", () => {
    expect(monthBoundaries("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
  });

  it("handles leap year February", () => {
    expect(monthBoundaries("2024-02")).toEqual({
      start: "2024-02-01",
      end: "2024-03-01",
    });
  });

  it("handles single-digit months with zero padding", () => {
    expect(monthBoundaries("2026-01")).toEqual({
      start: "2026-01-01",
      end: "2026-02-01",
    });
    expect(monthBoundaries("2026-09")).toEqual({
      start: "2026-09-01",
      end: "2026-10-01",
    });
  });
});
