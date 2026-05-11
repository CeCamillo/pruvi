import { describe, expect, it } from "vitest";
import { UsernameSchema, InviteCodeSchema } from "./social";

describe("UsernameSchema", () => {
  it.each([
    ["ana", true],
    ["ana_b", true],
    ["ana123", true],
    ["AnaBeta", false],     // uppercase
    ["ab", false],          // too short
    ["a".repeat(21), false],// too long
    ["ana b", false],       // space
    ["ana-b", false],       // dash
  ])("%s → %s", (input, valid) => {
    expect(UsernameSchema.safeParse(input).success).toBe(valid);
  });
});

describe("InviteCodeSchema", () => {
  it.each([
    ["abc12def", true],
    ["a1b2c3d4", true],
    ["ABC12DEF", false], // uppercase
    ["abc12de",  false], // 7 chars
    ["abc12defg",false], // 9 chars
    ["ab c12de", false], // space
  ])("%s → %s", (input, valid) => {
    expect(InviteCodeSchema.safeParse(input).success).toBe(valid);
  });
});
