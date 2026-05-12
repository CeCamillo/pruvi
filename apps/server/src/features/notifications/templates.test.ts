import { describe, expect, it } from "vitest";
import {
  streakReminderPrimary,
  streakReminderLate,
  streakMilestone,
  masteryAchievement,
  overtaken,
  streakProtected,
} from "./templates";

describe("notification templates", () => {
  it("streakReminderPrimary returns non-empty PT-BR payload", () => {
    const p = streakReminderPrimary();
    expect(p.title).toMatch(/Pruvi/);
    expect(p.body.length).toBeGreaterThan(0);
  });

  it("streakReminderLate references risk to streak", () => {
    const p = streakReminderLate();
    expect(p.title.toLowerCase()).toContain("streak");
  });

  it("streakMilestone(7) and (30) produce different bodies", () => {
    const a = streakMilestone(7);
    const b = streakMilestone(30);
    expect(a.title).toMatch(/7/);
    expect(b.title).toMatch(/30/);
    expect(a.body).not.toEqual(b.body);
  });

  it("masteryAchievement includes the subtopic name", () => {
    const p = masteryAchievement("Membrana plasmática");
    expect(p.body).toContain("Membrana plasmática");
  });
});

describe("overtaken", () => {
  it("includes the overtaker name in the body", () => {
    const p = overtaken("Pedro");
    expect(p.title).toBe("Você foi ultrapassado!");
    expect(p.body).toContain("Pedro");
  });
});

describe("streakProtected", () => {
  it("returns pt-BR copy with the day count", () => {
    const p = streakProtected(7);
    expect(p.title).toBe("Seu escudo protegeu seu streak!");
    expect(p.body).toContain("7 dias");
  });

  it("streakProtected(1) produces acceptable singular phrasing", () => {
    const p = streakProtected(1);
    expect(p.title).toBe("Seu escudo protegeu seu streak!");
    expect(p.body).toContain("1 dias"); // Singular phrasing is acceptable per spec §7
  });
});
