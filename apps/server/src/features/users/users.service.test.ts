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
    updateUsername: vi.fn(),
    deleteUser: vi.fn(),
  } as unknown as UsersRepository & {
    findById: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    updateUsername: ReturnType<typeof vi.fn>;
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

  describe("updateUsername", () => {
    it("returns updated username on success", async () => {
      repo.updateUsername.mockResolvedValue({ username: "newuser" });
      const result = await service.updateUsername(USER_ID, "newuser");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.username).toBe("newuser");
    });

    it("lowercases the username before saving", async () => {
      repo.updateUsername.mockResolvedValue({ username: "myuser" });
      await service.updateUsername(USER_ID, "MyUser");
      expect(repo.updateUsername).toHaveBeenCalledWith(USER_ID, "myuser");
    });

    it("returns NotFoundError when user is missing", async () => {
      repo.updateUsername.mockResolvedValue(undefined);
      const result = await service.updateUsername(USER_ID, "ghost");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.statusCode).toBe(404);
    });

    it("returns ConflictError on user_username_unique violation", async () => {
      repo.updateUsername.mockRejectedValue(
        new Error("duplicate key value violates unique constraint: user_username_unique"),
      );
      const result = await service.updateUsername(USER_ID, "taken");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.statusCode).toBe(409);
        expect(result.error.message).toMatch(/taken/i);
      }
    });

    it("re-throws unexpected DB errors", async () => {
      repo.updateUsername.mockRejectedValue(new Error("connection reset"));
      await expect(service.updateUsername(USER_ID, "test")).rejects.toThrow("connection reset");
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
