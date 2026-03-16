import { describe, expect, it } from "vitest";
import { ok, err } from "neverthrow";
import { successResponse, unwrapResult } from "./index";

describe("successResponse", () => {
  it("wraps data in a success envelope", () => {
    const result = successResponse({ id: 1, name: "test" });
    expect(result).toEqual({
      success: true,
      data: { id: 1, name: "test" },
    });
  });
});

describe("unwrapResult", () => {
  it("returns success response for Ok result", () => {
    const result = ok("hello");
    expect(unwrapResult(result)).toEqual({
      success: true,
      data: "hello",
    });
  });

  it("throws the error for Err result", () => {
    const error = new Error("something went wrong");
    const result = err(error);
    expect(() => unwrapResult(result)).toThrow("something went wrong");
  });
});
