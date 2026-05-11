import { describe, it, expect, vi, beforeEach } from "vitest";
import { LivesService } from "./lives.service";
import { LIVES_REGEN_INTERVAL_MS } from "@pruvi/shared";

function createMocks() {
  const repo = {
    materializeRegen: vi.fn(),
  };
  const service = new LivesService(repo as any);
  return { repo, service };
}

describe("LivesService", () => {
  let repo: ReturnType<typeof createMocks>["repo"];
  let service: LivesService;

  beforeEach(() => {
    ({ repo, service } = createMocks());
  });

  it("returns MAX_LIVES with resetsAt null when user not found (materializeRegen fallback)", async () => {
    repo.materializeRegen.mockResolvedValue({ lives: 5, lastRegenAt: null });

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(5);
    expect(value.maxLives).toBe(5);
    expect(value.resetsAt).toBeNull();
  });

  it("returns full lives with resetsAt null when lives at MAX and anchor is null", async () => {
    repo.materializeRegen.mockResolvedValue({ lives: 5, lastRegenAt: null });

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(5);
    expect(value.resetsAt).toBeNull();
  });

  it("returns partial lives with resetsAt = anchor + 4h", async () => {
    const anchor = new Date("2026-05-11T08:00:00Z");
    repo.materializeRegen.mockResolvedValue({ lives: 3, lastRegenAt: anchor });

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(3);
    expect(value.resetsAt).toEqual(new Date(anchor.getTime() + LIVES_REGEN_INTERVAL_MS));
  });

  it("returns 0 lives with resetsAt = anchor + 4h (not null)", async () => {
    const anchor = new Date("2026-05-11T06:00:00Z");
    repo.materializeRegen.mockResolvedValue({ lives: 0, lastRegenAt: anchor });

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(0);
    expect(value.resetsAt).toEqual(new Date(anchor.getTime() + LIVES_REGEN_INTERVAL_MS));
  });
});
