import { describe, expect, it, vi } from "vitest";
import { TokensService } from "./tokens.service";

function stubRepo(overrides: any = {}) {
  return {
    upsert: vi.fn().mockResolvedValue({ id: 1, token: "t", platform: "ios", userId: "u", lastUsedAt: new Date(), createdAt: new Date() }),
    deleteForUser: vi.fn().mockResolvedValue(undefined),
    listByUser: vi.fn().mockResolvedValue([]),
    deleteTokens: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("TokensService.register", () => {
  it("returns the upserted row data on success", async () => {
    const repo = stubRepo();
    const service = new TokensService(repo as any);
    const result = await service.register("u", "ExponentPushToken[a]", "ios");
    expect(result.isOk()).toBe(true);
    expect(repo.upsert).toHaveBeenCalledWith("u", "ExponentPushToken[a]", "ios");
  });
});

describe("TokensService.unregister", () => {
  it("calls deleteForUser and returns ok regardless", async () => {
    const repo = stubRepo();
    const service = new TokensService(repo as any);
    const result = await service.unregister("u", "ExponentPushToken[a]");
    expect(result.isOk()).toBe(true);
    expect(repo.deleteForUser).toHaveBeenCalledWith("u", "ExponentPushToken[a]");
  });
});

describe("TokensService.listTokensForUser", () => {
  it("returns just the token strings", async () => {
    const repo = stubRepo({
      listByUser: vi.fn().mockResolvedValue([
        { id: 1, token: "ExponentPushToken[a]", platform: "ios" },
        { id: 2, token: "ExponentPushToken[b]", platform: "android" },
      ]),
    });
    const service = new TokensService(repo as any);
    const tokens = await service.listTokensForUser("u");
    expect(tokens).toEqual(["ExponentPushToken[a]", "ExponentPushToken[b]"]);
  });
});
