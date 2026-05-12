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
import { MAX_STREAK_SHIELDS } from "@pruvi/shared";

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

    describe("acceptInvitation reward semantics (Phase 2E.6)", () => {
      it("preference=xp → +100 XP, reward_type=xp", async () => {
        await insertUser("inv-xp-1");
        await insertUser("invi-xp-1");
        // Default preference is 'xp'.
        const result = await repo.acceptInvitation("inv-xp-1", "invi-xp-1");
        expect(result).toEqual({ rewardType: "xp", xpAwarded: 100, shieldGranted: false });
        const inviter = await db.select({ xp: user.totalXp, shields: user.streakShieldsAvailable })
          .from(user).where(eq(user.id, "inv-xp-1"));
        expect(inviter[0]!.xp).toBe(100);
        expect(inviter[0]!.shields).toBe(0);
        const audit = await db.select({ rt: invitationAcceptance.rewardType })
          .from(invitationAcceptance).where(eq(invitationAcceptance.inviterId, "inv-xp-1"));
        expect(audit[0]!.rt).toBe("xp");
      });

      it("preference=shield + shields=0 → +1 shield, reward_type=shield", async () => {
        await insertUser("inv-sh-1");
        await insertUser("invi-sh-1");
        await db.update(user).set({ inviteRewardPreference: "shield" }).where(eq(user.id, "inv-sh-1"));
        const result = await repo.acceptInvitation("inv-sh-1", "invi-sh-1");
        expect(result).toEqual({ rewardType: "shield", xpAwarded: 0, shieldGranted: true });
        const inviter = await db.select({ xp: user.totalXp, shields: user.streakShieldsAvailable })
          .from(user).where(eq(user.id, "inv-sh-1"));
        expect(inviter[0]!.shields).toBe(1);
        expect(inviter[0]!.xp).toBe(0);
        const audit = await db.select({ rt: invitationAcceptance.rewardType })
          .from(invitationAcceptance).where(eq(invitationAcceptance.inviterId, "inv-sh-1"));
        expect(audit[0]!.rt).toBe("shield");
      });

      it("preference=shield + shields already at MAX → falls back to XP, reward_type=xp", async () => {
        await insertUser("inv-cap-1");
        await insertUser("invi-cap-1");
        await db.update(user)
          .set({ inviteRewardPreference: "shield", streakShieldsAvailable: MAX_STREAK_SHIELDS })
          .where(eq(user.id, "inv-cap-1"));
        const result = await repo.acceptInvitation("inv-cap-1", "invi-cap-1");
        expect(result).toEqual({ rewardType: "xp", xpAwarded: 100, shieldGranted: false });
        const inviter = await db.select({ xp: user.totalXp, shields: user.streakShieldsAvailable })
          .from(user).where(eq(user.id, "inv-cap-1"));
        expect(inviter[0]!.shields).toBe(MAX_STREAK_SHIELDS); // unchanged
        expect(inviter[0]!.xp).toBe(100);
        const audit = await db.select({ rt: invitationAcceptance.rewardType })
          .from(invitationAcceptance).where(eq(invitationAcceptance.inviterId, "inv-cap-1"));
        expect(audit[0]!.rt).toBe("xp");
      });

      it("race-safe: two concurrent shield-pref accepts at shields=0 produce exactly one shield + one XP", async () => {
        await insertUser("inv-race");
        await insertUser("invi-race-A", { inviteCode: "racecodea1" });
        await insertUser("invi-race-B", { inviteCode: "racecodeb2" });
        // Inviter prefers shield, currently has 0 shields.
        await db.update(user)
          .set({ inviteRewardPreference: "shield", streakShieldsAvailable: 0 })
          .where(eq(user.id, "inv-race"));

        // Fire two concurrent accepts.
        const [r1, r2] = await Promise.allSettled([
          repo.acceptInvitation("inv-race", "invi-race-A"),
          repo.acceptInvitation("inv-race", "invi-race-B"),
        ]);

        // Both should resolve (no exception thrown). The repo's transaction handles concurrency.
        // One acceptance grants the shield; the other falls back to XP via the lt() predicate.
        const successfuls = [r1, r2].filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<typeof r1 extends PromiseFulfilledResult<infer V> ? V : never>).value);
        // Exactly 2 fulfilled (the race-safe predicate handles both; no DB-level conflict on this path).
        expect(successfuls.length).toBe(2);

        const shieldCount = successfuls.filter((s) => s.rewardType === "shield").length;
        const xpCount = successfuls.filter((s) => s.rewardType === "xp").length;
        expect(shieldCount).toBe(1);
        expect(xpCount).toBe(1);

        // Verify inviter state: exactly 1 shield (cap respected), exactly 100 XP (the fallback).
        const inviter = await db.select({ xp: user.totalXp, shields: user.streakShieldsAvailable })
          .from(user).where(eq(user.id, "inv-race"));
        expect(inviter[0]!.shields).toBe(MAX_STREAK_SHIELDS);
        expect(inviter[0]!.xp).toBe(100);

        // Audit rows reflect actual delivered rewards.
        const audit = await db.select({ rt: invitationAcceptance.rewardType })
          .from(invitationAcceptance).where(eq(invitationAcceptance.inviterId, "inv-race"));
        expect(audit.length).toBe(2);
        const rts = audit.map((a) => a.rt).sort();
        expect(rts).toEqual(["shield", "xp"]);
      });
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
