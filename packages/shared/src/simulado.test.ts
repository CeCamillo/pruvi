import { describe, it, expect } from "vitest";
import { weekBoundsForSimulado, SIMULADO_QUESTION_COUNT } from "./simulado";

describe("SIMULADO_QUESTION_COUNT", () => {
  it("is 35 (mid-range of product spec 30-40)", () => {
    expect(SIMULADO_QUESTION_COUNT).toBe(35);
  });
});

describe("weekBoundsForSimulado", () => {
  it("for Sunday 12:00 BRT (15:00 UTC), weekStart is that same Sunday's BRT date", () => {
    // 2026-05-10 (Sunday) 15:00 UTC == 12:00 BRT
    const now = new Date("2026-05-10T15:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-10");
    expect(weekEnd).toBe("2026-05-17");
  });

  it("for Saturday 23:00 BRT (2026-05-09 23:00 BRT == 2026-05-10 02:00 UTC), weekStart is the PREVIOUS Sunday", () => {
    const now = new Date("2026-05-10T02:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-03");
    expect(weekEnd).toBe("2026-05-10");
  });

  it("for Sunday 02:00 BRT (Sun 05:00 UTC), weekStart is THAT Sunday's BRT date", () => {
    const now = new Date("2026-05-10T05:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-10");
    expect(weekEnd).toBe("2026-05-17");
  });

  it("for Sunday 01:00 UTC (Saturday 22:00 BRT), weekStart is the PREVIOUS Sunday", () => {
    const now = new Date("2026-05-10T01:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-03");
    expect(weekEnd).toBe("2026-05-10");
  });

  it("for Sunday 00:00 BRT exactly (Sunday 03:00 UTC), weekStart is THAT Sunday", () => {
    const now = new Date("2026-05-10T03:00:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-10");
    expect(weekEnd).toBe("2026-05-17");
  });

  it("for Sunday 23:59 BRT (Monday 02:59 UTC), weekStart is THAT Sunday", () => {
    const now = new Date("2026-05-11T02:59:00Z");
    const { weekStart, weekEnd } = weekBoundsForSimulado(now);
    expect(weekStart).toBe("2026-05-10");
    expect(weekEnd).toBe("2026-05-17");
  });
});
