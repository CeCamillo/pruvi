import { describe, expect, it, vi } from "vitest";

// Mock env and auth — they require DATABASE_URL and a real DB connection at import time
vi.mock("@pruvi/env/server", () => ({
  env: {
    CORS_ORIGIN: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));
vi.mock("@pruvi/auth", () => ({
  auth: {
    handler: vi.fn(),
    api: { getSession: vi.fn() },
  },
}));
vi.mock("@pruvi/db", () => ({
  db: {},
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) },
}));

import { buildApp } from "./index";

describe("server", () => {
  it("returns OK on health check", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: "OK" });
  });

  it("returns 404 for unknown routes", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/nonexistent" });
    expect(res.statusCode).toBe(404);
  });
});
