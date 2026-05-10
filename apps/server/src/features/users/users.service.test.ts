import { describe, it, expect, beforeEach, vi } from "vitest";
import { UsersService } from "./users.service";
import type { UsersRepository } from "./users.repository";

const USER_ID = "user-1";
const baseUser = {
  id: USER_ID,
  name: "Test User",
  email: "test@example.com",
  image: null as string | null,
};

function makeMockRepo() {
  return {
    findById: vi.fn(),
    updateProfile: vi.fn(),
    deleteUser: vi.fn(),
  } as unknown as UsersRepository & {
    findById: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };
}

describe("UsersService", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: UsersService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new UsersService(repo);
  });

  describe("updateProfile", () => {
    it("returns updated profile", async () => {
      repo.updateProfile.mockResolvedValue({ ...baseUser, name: "Updated" });
      const result = await service.updateProfile(USER_ID, { name: "Updated" });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.name).toBe("Updated");
    });

    it("returns NotFoundError when user missing", async () => {
      repo.updateProfile.mockResolvedValue(undefined);
      const result = await service.updateProfile(USER_ID, { name: "X" });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.statusCode).toBe(404);
    });
  });

  describe("deleteAccount", () => {
    it("deletes existing user", async () => {
      repo.findById.mockResolvedValue(baseUser);
      const result = await service.deleteAccount(USER_ID);
      expect(result.isOk()).toBe(true);
      expect(repo.deleteUser).toHaveBeenCalledWith(USER_ID);
    });

    it("returns NotFoundError when user missing", async () => {
      repo.findById.mockResolvedValue(null);
      const result = await service.deleteAccount(USER_ID);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.statusCode).toBe(404);
      expect(repo.deleteUser).not.toHaveBeenCalled();
    });
  });
});
