import { describe, expect, it } from "vitest";
import { generateInviteCode, INVITE_CODE_ALPHABET } from "./generator";

describe("generateInviteCode", () => {
  it("returns 8 chars", () => {
    expect(generateInviteCode()).toHaveLength(8);
  });

  it("only contains alphabet chars", () => {
    for (let i = 0; i < 100; i++) {
      const c = generateInviteCode();
      for (const ch of c) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("low collision rate over 10k samples", () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateInviteCode());
    expect(set.size).toBeGreaterThan(9990); // < 0.1% collisions
  });
});
