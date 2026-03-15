import { describe, it, expect } from "vitest";
import { SM2StateSchema, INITIAL_SM2_STATE } from "./sm2";

describe("SM2StateSchema", () => {
  it("accepts the initial state", () => {
    const result = SM2StateSchema.safeParse(INITIAL_SM2_STATE);
    expect(result.success).toBe(true);
  });

  it("rejects easinessFactor below 1.3", () => {
    const result = SM2StateSchema.safeParse({
      ...INITIAL_SM2_STATE,
      easinessFactor: 1.2,
    });
    expect(result.success).toBe(false);
  });
});
