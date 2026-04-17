import { describe, expect, it } from "bun:test";

import {
  buildMonthGrid,
  currentMonth,
  formatMonthLabelPt,
  formatRelativeTime,
} from "../date-format";

describe("currentMonth", () => {
  it("formats YYYY-MM with zero-padded month", () => {
    expect(currentMonth(new Date(2026, 0, 1))).toBe("2026-01");
    expect(currentMonth(new Date(2026, 8, 1))).toBe("2026-09");
    expect(currentMonth(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("formatMonthLabelPt", () => {
  it("renders PT-BR month names with year", () => {
    expect(formatMonthLabelPt(new Date(2026, 0, 15))).toBe("Janeiro 2026");
    expect(formatMonthLabelPt(new Date(2026, 2, 15))).toBe("Março 2026");
    expect(formatMonthLabelPt(new Date(2026, 11, 31))).toBe("Dezembro 2026");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-04-16T12:00:00Z");

  function iso(offsetMs: number): string {
    return new Date(now.getTime() + offsetMs).toISOString();
  }

  it("returns 'agora' for future timestamps (clock drift)", () => {
    expect(formatRelativeTime(iso(60_000), now)).toBe("agora");
    expect(formatRelativeTime(iso(5 * 60 * 60 * 1000), now)).toBe("agora");
  });

  it("returns 'agora' for sub-minute past", () => {
    expect(formatRelativeTime(iso(-10_000), now)).toBe("agora");
    expect(formatRelativeTime(iso(-59_000), now)).toBe("agora");
  });

  it("returns minutes under an hour", () => {
    expect(formatRelativeTime(iso(-5 * 60_000), now)).toBe("há 5min");
    expect(formatRelativeTime(iso(-59 * 60_000), now)).toBe("há 59min");
  });

  it("returns hours under a day", () => {
    expect(formatRelativeTime(iso(-2 * 60 * 60_000), now)).toBe("há 2h");
    expect(formatRelativeTime(iso(-23 * 60 * 60_000), now)).toBe("há 23h");
  });

  it("returns 'ontem' at 24h", () => {
    expect(formatRelativeTime(iso(-24 * 60 * 60_000), now)).toBe("ontem");
  });

  it("returns days under a week", () => {
    expect(formatRelativeTime(iso(-3 * 24 * 60 * 60_000), now)).toBe("há 3 dias");
    expect(formatRelativeTime(iso(-6 * 24 * 60 * 60_000), now)).toBe("há 6 dias");
  });

  it("returns weeks for 7 to ~29 days", () => {
    expect(formatRelativeTime(iso(-7 * 24 * 60 * 60_000), now)).toBe("há 1 semana");
    expect(formatRelativeTime(iso(-14 * 24 * 60 * 60_000), now)).toBe("há 2 semanas");
    // Regression: the 28-day boundary used to yield "há 0 meses".
    expect(formatRelativeTime(iso(-28 * 24 * 60 * 60_000), now)).toBe("há 4 semanas");
    expect(formatRelativeTime(iso(-29 * 24 * 60 * 60_000), now)).toBe("há 4 semanas");
  });

  it("returns months once at least 30 days elapse", () => {
    expect(formatRelativeTime(iso(-30 * 24 * 60 * 60_000), now)).toBe("há 1 mês");
    expect(formatRelativeTime(iso(-60 * 24 * 60 * 60_000), now)).toBe("há 2 meses");
    expect(formatRelativeTime(iso(-365 * 24 * 60 * 60_000), now)).toBe("há 12 meses");
  });
});

describe("buildMonthGrid", () => {
  it("builds exactly 42 cells", () => {
    const cells = buildMonthGrid("2026-04", new Set(), new Date(2026, 3, 16));
    expect(cells).toHaveLength(42);
  });

  it("flags the right day as today when in month", () => {
    const cells = buildMonthGrid("2026-04", new Set(), new Date(2026, 3, 16));
    const today = cells.find((c) => c.isToday);
    expect(today).toBeDefined();
    expect(today?.day).toBe(16);
    expect(today?.dateStr).toBe("2026-04-16");
  });

  it("does not flag today when viewing a different month", () => {
    const cells = buildMonthGrid("2026-03", new Set(), new Date(2026, 3, 16));
    expect(cells.some((c) => c.isToday)).toBe(false);
  });

  it("marks studied days inside the target month", () => {
    const studied = new Set(["2026-04-01", "2026-04-15"]);
    const cells = buildMonthGrid("2026-04", studied, new Date(2026, 3, 16));
    const matched = cells.filter((c) => c.studied).map((c) => c.dateStr);
    expect(matched).toEqual(["2026-04-01", "2026-04-15"]);
  });

  it("leaves cells outside the target month blank", () => {
    const cells = buildMonthGrid("2026-04", new Set(), new Date(2026, 3, 16));
    const outside = cells.filter((c) => !c.inMonth);
    outside.forEach((c) => {
      expect(c.day).toBeNull();
      expect(c.studied).toBe(false);
      expect(c.isToday).toBe(false);
    });
  });

  it("handles leap-year February", () => {
    const cells = buildMonthGrid("2024-02", new Set(), new Date(2024, 1, 15));
    const daysInMonth = cells.filter((c) => c.inMonth);
    expect(daysInMonth).toHaveLength(29);
  });

  it("handles month starting on a Saturday (max leading blanks)", () => {
    // August 2026 starts on a Saturday → 6 leading blank cells
    const cells = buildMonthGrid("2026-08", new Set(), new Date(2026, 7, 1));
    const leadingBlanks = cells.slice(0, 6);
    leadingBlanks.forEach((c) => expect(c.inMonth).toBe(false));
    expect(cells[6]?.day).toBe(1);
  });
});
