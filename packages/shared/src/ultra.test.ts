import { describe, expect, it } from "vitest";
import { UltraStatusSchema, GrantUltraBodySchema } from "./ultra";

describe("UltraStatusSchema", () => {
  it("accepts isUltra=true with ISO expiry", () => {
    expect(UltraStatusSchema.safeParse({ isUltra: true, expiresAt: "2026-06-12T00:00:00.000Z" }).success).toBe(true);
  });
  it("accepts isUltra=false with null expiry", () => {
    expect(UltraStatusSchema.safeParse({ isUltra: false, expiresAt: null }).success).toBe(true);
  });
  it("rejects non-ISO expiry", () => {
    expect(UltraStatusSchema.safeParse({ isUltra: true, expiresAt: "tomorrow" }).success).toBe(false);
  });
});

describe("GrantUltraBodySchema", () => {
  it("requires expiresAt", () => {
    expect(GrantUltraBodySchema.safeParse({}).success).toBe(false);
  });
  it("accepts ISO datetime", () => {
    expect(GrantUltraBodySchema.safeParse({ expiresAt: "2026-06-12T00:00:00.000Z" }).success).toBe(true);
  });
});
