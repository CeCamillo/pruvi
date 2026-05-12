import { describe, expect, it, vi, beforeEach } from "vitest";
import { InvitationsService } from "./invitations.service";
import type { InvitationsRepository } from "./invitations.repository";
import { NotFoundError, ValidationError } from "../../../utils/errors";

function makeRepo(overrides?: Partial<InvitationsRepository>): InvitationsRepository {
  return {
    ensureInviteCode: vi.fn().mockResolvedValue("abc12345"),
    findInviterByCode: vi.fn().mockResolvedValue(null),
    hasAccepted: vi.fn().mockResolvedValue(false),
    acceptInvitation: vi.fn().mockResolvedValue({ rewardType: "xp", xpAwarded: 100, shieldGranted: false }),
    ...overrides,
  } as unknown as InvitationsRepository;
}

describe("InvitationsService", () => {
  describe("getInvite", () => {
    it("returns code and url for the user", async () => {
      const repo = makeRepo({
        ensureInviteCode: vi.fn().mockResolvedValue("abc12345"),
      });
      const service = new InvitationsService(repo);

      const result = await service.getInvite("user-1");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.code).toBe("abc12345");
        expect(result.value.url).toMatch(/\/abc12345$/);
      }
    });
  });

  describe("acceptInvitation", () => {
    it("returns NotFoundError when invite code does not exist", async () => {
      const repo = makeRepo({
        findInviterByCode: vi.fn().mockResolvedValue(null),
      });
      const service = new InvitationsService(repo);

      const result = await service.acceptInvitation("notexist", "user-1");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toBe("Invite code not found");
      }
    });

    it("returns ValidationError when user tries to accept their own invite", async () => {
      const repo = makeRepo({
        findInviterByCode: vi.fn().mockResolvedValue({
          id: "user-1",
          name: "Alice",
          username: "alice",
        }),
      });
      const service = new InvitationsService(repo);

      const result = await service.acceptInvitation("abc12345", "user-1");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe("Cannot accept your own invite");
      }
    });

    it("returns ValidationError when user has already accepted an invitation", async () => {
      const repo = makeRepo({
        findInviterByCode: vi.fn().mockResolvedValue({
          id: "inviter-id",
          name: "Bob",
          username: "bob",
        }),
        hasAccepted: vi.fn().mockResolvedValue(true),
      });
      const service = new InvitationsService(repo);

      const result = await service.acceptInvitation("abc12345", "user-2");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe("You have already accepted an invitation");
      }
    });

    it("returns +100 XP shape on success", async () => {
      const repo = makeRepo({
        findInviterByCode: vi.fn().mockResolvedValue({
          id: "inviter-id",
          name: "Bob",
          username: "bob",
        }),
        hasAccepted: vi.fn().mockResolvedValue(false),
        acceptInvitation: vi.fn().mockResolvedValue({ rewardType: "xp", xpAwarded: 100, shieldGranted: false }),
      });
      const service = new InvitationsService(repo);

      const result = await service.acceptInvitation("abc12345", "user-2");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.reward.xpAwarded).toBe(100);
        expect(result.value.reward).toEqual({ type: "xp", xpAwarded: 100, shieldGranted: false });
        expect(result.value.friendshipCreated).toBe(true);
        expect(result.value.inviter.name).toBe("Bob");
        expect(result.value.inviter.username).toBe("bob");
      }
    });

    it("returns shield reward shape when repo grants a shield", async () => {
      const repo = makeRepo({
        findInviterByCode: vi.fn().mockResolvedValue({
          id: "inviter-id",
          name: "Bob",
          username: "bob",
        }),
        hasAccepted: vi.fn().mockResolvedValue(false),
        acceptInvitation: vi.fn().mockResolvedValue({ rewardType: "shield", xpAwarded: 0, shieldGranted: true }),
      });
      const service = new InvitationsService(repo);

      const result = await service.acceptInvitation("abc12345", "user-2");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.reward.type).toBe("shield");
        expect(result.value.reward).toEqual({ type: "shield", xpAwarded: 0, shieldGranted: true });
        expect(result.value.friendshipCreated).toBe(true);
      }
    });

    it("returns ValidationError on duplicate-key constraint error", async () => {
      const repo = makeRepo({
        findInviterByCode: vi.fn().mockResolvedValue({
          id: "inviter-id",
          name: "Bob",
          username: "bob",
        }),
        hasAccepted: vi.fn().mockResolvedValue(false),
        acceptInvitation: vi.fn().mockRejectedValue(
          new Error("duplicate key value violates unique constraint: invitation_acceptance"),
        ),
      });
      const service = new InvitationsService(repo);

      const result = await service.acceptInvitation("abc12345", "user-2");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });
});
