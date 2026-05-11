import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { invitationAcceptance } from "@pruvi/db/schema/invitation-acceptance";
import { friendship } from "@pruvi/db/schema/friendship";
import { InvitationsRepository } from "./invitations.repository";

describe("InvitationsRepository (integration)", () => {
  const db = getTestDb();
  const repo = new InvitationsRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function insertUser(
    id: string,
    opts?: { inviteCode?: string; username?: string },
  ) {
    await db.insert(user).values({
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      emailVerified: false,
      inviteCode: opts?.inviteCode ?? `code${id.replace(/-/g, "").slice(0, 8)}`,
      username: opts?.username ?? null,
      updatedAt: new Date(),
    });
  }

  describe("ensureInviteCode", () => {
    it("returns existing invite code for a user", async () => {
      await insertUser("user-a", { inviteCode: "abcd1234" });
      const code = await repo.ensureInviteCode("user-a");
      expect(code).toBe("abcd1234");
    });

    it("returns the same code on repeated calls (idempotent)", async () => {
      await insertUser("user-b", { inviteCode: "efgh5678" });
      const code1 = await repo.ensureInviteCode("user-b");
      const code2 = await repo.ensureInviteCode("user-b");
      expect(code1).toBe(code2);
    });
  });

  describe("findInviterByCode", () => {
    it("resolves the inviter by code", async () => {
      await insertUser("inviter-1", { inviteCode: "mycode12", username: "alice" });
      const inviter = await repo.findInviterByCode("mycode12");
      expect(inviter).not.toBeNull();
      expect(inviter?.id).toBe("inviter-1");
      expect(inviter?.username).toBe("alice");
    });

    it("returns null for a non-existent code", async () => {
      const inviter = await repo.findInviterByCode("zzzzzzzz");
      expect(inviter).toBeNull();
    });
  });

  describe("hasAccepted", () => {
    it("returns false when no acceptance exists", async () => {
      await insertUser("invitee-x");
      const result = await repo.hasAccepted("invitee-x");
      expect(result).toBe(false);
    });

    it("returns true after acceptance is recorded", async () => {
      await insertUser("inviter-2", { inviteCode: "aaaa1111" });
      await insertUser("invitee-2");
      await repo.acceptInvitation("inviter-2", "invitee-2");
      const result = await repo.hasAccepted("invitee-2");
      expect(result).toBe(true);
    });
  });

  describe("acceptInvitation", () => {
    it("commits all 3 mutations atomically: acceptance record, +100 XP, and friendship", async () => {
      await insertUser("inviter-3", { inviteCode: "bbbb2222" });
      await insertUser("invitee-3");

      // verify initial XP
      const [inviterBefore] = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "inviter-3"));
      expect(inviterBefore?.totalXp).toBe(0);

      await repo.acceptInvitation("inviter-3", "invitee-3");

      // inviter gets +100 XP
      const [inviterAfter] = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "inviter-3"));
      expect(inviterAfter?.totalXp).toBe(100);

      // invitation_acceptance row created
      const acceptances = await db
        .select()
        .from(invitationAcceptance)
        .where(eq(invitationAcceptance.inviteeId, "invitee-3"));
      expect(acceptances).toHaveLength(1);
      expect(acceptances[0]?.inviterId).toBe("inviter-3");

      // friendship row created in accepted state
      const friendships = await db
        .select()
        .from(friendship)
        .where(eq(friendship.recipientId, "invitee-3"));
      expect(friendships).toHaveLength(1);
      expect(friendships[0]?.status).toBe("accepted");
      expect(friendships[0]?.requesterId).toBe("inviter-3");
    });

    it("does not partially commit when friendship insert fails due to duplicate (atomicity)", async () => {
      await insertUser("inviter-4", { inviteCode: "cccc3333" });
      await insertUser("invitee-4");

      // First acceptance succeeds
      await repo.acceptInvitation("inviter-4", "invitee-4");

      // Second attempt must fail with a constraint error (invitee_id unique on invitation_acceptance)
      await expect(
        repo.acceptInvitation("inviter-4", "invitee-4"),
      ).rejects.toThrow();

      // XP should only be 100 (only 1 success), not 200
      const [inviterAfter] = await db
        .select({ totalXp: user.totalXp })
        .from(user)
        .where(eq(user.id, "inviter-4"));
      expect(inviterAfter?.totalXp).toBe(100);

      // Still only 1 acceptance record
      const acceptances = await db
        .select()
        .from(invitationAcceptance)
        .where(eq(invitationAcceptance.inviteeId, "invitee-4"));
      expect(acceptances).toHaveLength(1);
    });
  });
});
