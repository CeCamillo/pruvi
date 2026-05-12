import { describe, expect, it, vi } from "vitest";

vi.mock("@pruvi/env/server", () => ({
  env: { NODE_ENV: "test" },
}));
vi.mock("@pruvi/db", () => ({
  db: {},
}));

describe("startBillingSweepWorker", () => {
  it("returns null and does not crash when REDIS_URL is absent", async () => {
    const { startBillingSweepWorker } = await import("./billing-sweep.worker");
    const result = startBillingSweepWorker();
    expect(result).toBeNull();
  });
});
