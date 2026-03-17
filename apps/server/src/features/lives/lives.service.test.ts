import { describe, it, expect, vi, beforeEach } from "vitest";
import { LivesService } from "./lives.service";

function createMocks() {
  const repo = {
    getUserLives: vi.fn(),
    resetLives: vi.fn(),
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

  it("returns default MAX_LIVES when user not found", async () => {
    repo.getUserLives.mockResolvedValue(null);

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(5);
    expect(value.maxLives).toBe(5);
    expect(value.resetsAt).toBeNull();
  });

  it("returns full lives with no reset timer", async () => {
    repo.getUserLives.mockResolvedValue({ lives: 5, livesResetAt: null });

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(5);
    expect(value.resetsAt).toBeNull();
  });

  it("auto-refills lives when livesResetAt is in the past", async () => {
    const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
    repo.getUserLives.mockResolvedValue({ lives: 2, livesResetAt: pastDate });
    repo.resetLives.mockResolvedValue(undefined);

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(5);
    expect(value.resetsAt).toBeNull();
    expect(repo.resetLives).toHaveBeenCalledWith("user-1");
  });

  it("returns partial lives with future resetsAt as-is", async () => {
    const futureDate = new Date(Date.now() + 3_600_000); // 1 hour from now
    repo.getUserLives.mockResolvedValue({ lives: 3, livesResetAt: futureDate });

    const result = await service.getLives("user-1");

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.lives).toBe(3);
    expect(value.resetsAt).toEqual(futureDate);
    expect(repo.resetLives).not.toHaveBeenCalled();
  });
});
