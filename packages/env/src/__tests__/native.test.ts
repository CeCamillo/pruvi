import { describe, expect, it } from "bun:test";

function loadEnv(envOverride: Record<string, string | undefined>) {
  const original: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(envOverride)) {
    original[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const path = require.resolve("../native");
  delete require.cache[path];
  try {
    return require("../native");
  } finally {
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("native env", () => {
  it("rejects missing EXPO_PUBLIC_SERVER_URL at parse time", () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_SERVER_URL: undefined })
    ).toThrow();
  });

  it("rejects empty string EXPO_PUBLIC_SERVER_URL", () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_SERVER_URL: "" })
    ).toThrow();
  });

  it("rejects non-URL strings", () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_SERVER_URL: "not a url" })
    ).toThrow();
  });

  it("accepts a valid URL", () => {
    const { env } = loadEnv({ EXPO_PUBLIC_SERVER_URL: "http://localhost:3000" });
    expect(env.EXPO_PUBLIC_SERVER_URL).toBe("http://localhost:3000");
  });
});
