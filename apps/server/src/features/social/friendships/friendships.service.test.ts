import { describe, expect, it, vi } from "vitest";
import { FriendshipsService } from "./friendships.service";
import type { FriendshipsRepository } from "./friendships.repository";
import { NotFoundError, ValidationError } from "../../../utils/errors";

function makeRepo(overrides?: Partial<FriendshipsRepository>): FriendshipsRepository {
  return {
    findByUsername: vi.fn().mockResolvedValue(null),
    findExistingPair: vi.fn().mockResolvedValue(null),
    createRequest: vi.fn().mockResolvedValue({ id: 1 }),
    getRequest: vi.fn().mockResolvedValue(null),
    respond: vi.fn().mockResolvedValue(undefined),
    listAcceptedFriendsWithUserData: vi.fn().mockResolvedValue([]),
    listIncomingRequests: vi.fn().mockResolvedValue([]),
    deletePair: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FriendshipsRepository;
}

const mockTarget = {
  id: "target-id",
  name: "Alice",
  username: "alice",
  image: null,
};

describe("FriendshipsService", () => {
  describe("requestByUsername", () => {
    it("returns NotFoundError when user not found", async () => {
      const repo = makeRepo({ findByUsername: vi.fn().mockResolvedValue(null) });
      const service = new FriendshipsService(repo);

      const result = await service.requestByUsername("user-1", "nobody");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toBe("User not found");
      }
    });

    it("returns ValidationError when requesting friendship with self", async () => {
      const repo = makeRepo({
        findByUsername: vi.fn().mockResolvedValue({ ...mockTarget, id: "user-1" }),
      });
      const service = new FriendshipsService(repo);

      const result = await service.requestByUsername("user-1", "alice");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe("Cannot friend yourself");
      }
    });

    it("returns ValidationError when pair already exists with status pending", async () => {
      const repo = makeRepo({
        findByUsername: vi.fn().mockResolvedValue(mockTarget),
        findExistingPair: vi.fn().mockResolvedValue({ id: 5, status: "pending" }),
      });
      const service = new FriendshipsService(repo);

      const result = await service.requestByUsername("user-1", "alice");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain("pending");
      }
    });

    it("returns ValidationError when pair already exists with status accepted", async () => {
      const repo = makeRepo({
        findByUsername: vi.fn().mockResolvedValue(mockTarget),
        findExistingPair: vi.fn().mockResolvedValue({ id: 5, status: "accepted" }),
      });
      const service = new FriendshipsService(repo);

      const result = await service.requestByUsername("user-1", "alice");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain("accepted");
      }
    });

    it("returns ValidationError when pair already exists with status declined", async () => {
      const repo = makeRepo({
        findByUsername: vi.fn().mockResolvedValue(mockTarget),
        findExistingPair: vi.fn().mockResolvedValue({ id: 5, status: "declined" }),
      });
      const service = new FriendshipsService(repo);

      const result = await service.requestByUsername("user-1", "alice");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain("declined");
      }
    });

    it("returns requestId and recipient on success", async () => {
      const repo = makeRepo({
        findByUsername: vi.fn().mockResolvedValue(mockTarget),
        findExistingPair: vi.fn().mockResolvedValue(null),
        createRequest: vi.fn().mockResolvedValue({ id: 42 }),
      });
      const service = new FriendshipsService(repo);

      const result = await service.requestByUsername("user-1", "alice");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.requestId).toBe(42);
        expect(result.value.recipient.username).toBe("alice");
        expect(result.value.recipient.name).toBe("Alice");
      }
    });
  });

  describe("respond", () => {
    it("returns NotFoundError when request not found", async () => {
      const repo = makeRepo({ getRequest: vi.fn().mockResolvedValue(null) });
      const service = new FriendshipsService(repo);

      const result = await service.respond(99, "accept", "user-1");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toBe("Request not found");
      }
    });

    it("returns accepted status on accept", async () => {
      const repo = makeRepo({
        getRequest: vi.fn().mockResolvedValue({ id: 1, status: "pending" }),
        respond: vi.fn().mockResolvedValue(undefined),
      });
      const service = new FriendshipsService(repo);

      const result = await service.respond(1, "accept", "user-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("accepted");
      }
      expect(repo.respond).toHaveBeenCalledWith(1, "accept");
    });

    it("returns declined status on decline and does not set acceptedAt", async () => {
      const repo = makeRepo({
        getRequest: vi.fn().mockResolvedValue({ id: 2, status: "pending" }),
        respond: vi.fn().mockResolvedValue(undefined),
      });
      const service = new FriendshipsService(repo);

      const result = await service.respond(2, "decline", "user-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("declined");
      }
      expect(repo.respond).toHaveBeenCalledWith(2, "decline");
    });
  });

  describe("listFriends", () => {
    it("returns friends when current user is the requester", async () => {
      const friendAsRecipient = {
        id: "friend-id",
        name: "Bob",
        username: "bob",
        image: null,
      };
      const repo = makeRepo({
        listAcceptedFriendsWithUserData: vi.fn().mockResolvedValue([friendAsRecipient]),
      });
      const service = new FriendshipsService(repo);

      const result = await service.listFriends("user-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.friends).toHaveLength(1);
        expect(result.value.friends[0]?.id).toBe("friend-id");
      }
    });

    it("returns friends when current user is the recipient", async () => {
      const friendAsRequester = {
        id: "requester-id",
        name: "Carol",
        username: "carol",
        image: null,
      };
      const repo = makeRepo({
        listAcceptedFriendsWithUserData: vi
          .fn()
          .mockResolvedValue([friendAsRequester]),
      });
      const service = new FriendshipsService(repo);

      const result = await service.listFriends("user-2");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.friends).toHaveLength(1);
        expect(result.value.friends[0]?.id).toBe("requester-id");
      }
    });

    it("returns empty list when user has no friends", async () => {
      const repo = makeRepo({
        listAcceptedFriendsWithUserData: vi.fn().mockResolvedValue([]),
      });
      const service = new FriendshipsService(repo);

      const result = await service.listFriends("user-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.friends).toHaveLength(0);
      }
    });
  });

  describe("listRequests", () => {
    it("returns incoming requests with ISO createdAt", async () => {
      const now = new Date("2026-05-11T10:00:00.000Z");
      const repo = makeRepo({
        listIncomingRequests: vi.fn().mockResolvedValue([
          {
            id: 7,
            createdAt: now,
            from: { id: "sender-id", name: "Dave", username: "dave", image: null },
          },
        ]),
      });
      const service = new FriendshipsService(repo);

      const result = await service.listRequests("user-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.incoming).toHaveLength(1);
        expect(result.value.incoming[0]?.id).toBe(7);
        expect(result.value.incoming[0]?.createdAt).toBe("2026-05-11T10:00:00.000Z");
        expect(result.value.incoming[0]?.from.username).toBe("dave");
      }
    });
  });

  describe("unfriend", () => {
    it("calls deletePair and returns ok", async () => {
      const repo = makeRepo({
        deletePair: vi.fn().mockResolvedValue(undefined),
      });
      const service = new FriendshipsService(repo);

      const result = await service.unfriend("user-1", "user-2");

      expect(result.isOk()).toBe(true);
      expect(repo.deletePair).toHaveBeenCalledWith("user-1", "user-2");
    });
  });
});
