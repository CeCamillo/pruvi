import { describe, expect, it } from "vitest";
import {
  streakReminderPrimary,
  streakReminderLate,
  streakMilestone,
  masteryAchievement,
  type PushPayload,
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
