import { and, eq, lt, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { invitationAcceptance } from "@pruvi/db/schema/invitation-acceptance";
import { friendship } from "@pruvi/db/schema/friendship";
import { generateInviteCode } from "../invite-codes/generator";
import { MAX_STREAK_SHIELDS } from "@pruvi/shared";

type Db = typeof DbClient;

export class InvitationsRepository {
  constructor(private db: Db) {}

  async ensureInviteCode(userId: string): Promise<string> {
    const rows = await this.db
      .select({ code: user.inviteCode })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (rows[0]?.code) return rows[0].code;
    // Defensive: backfilled at migration; if absent (race or test fixture), generate.
    for (let i = 0; i < 5; i++) {
      const code = generateInviteCode();
      try {
        await this.db
          .update(user)
          .set({ inviteCode: code })
          .where(eq(user.id, userId));
        return code;
      } catch {
        // retry on unique violation
      }
    }
    throw new Error("Could not assign invite code");
  }

  async findInviterByCode(
    code: string,
  ): Promise<{ id: string; name: string; username: string | null } | null> {
    const rows = await this.db
      .select({ id: user.id, name: user.name, username: user.username })
      .from(user)
      .where(eq(user.inviteCode, code))
      .limit(1);
    return rows[0] ?? null;
  }

  async hasAccepted(inviteeId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: invitationAcceptance.id })
      .from(invitationAcceptance)
      .where(eq(invitationAcceptance.inviteeId, inviteeId))
      .limit(1);
    return rows.length > 0;
  }

  /** Atomic: record acceptance + reward (XP or shield) to inviter + upsert accepted friendship. */
  async acceptInvitation(
    inviterId: string,
    inviteeId: string,
  ): Promise<{ rewardType: "xp" | "shield"; xpAwarded: number; shieldGranted: boolean }> {
    return await this.db.transaction(async (tx) => {
      // 1. Read inviter preference.
      const inviter = await tx
        .select({ pref: user.inviteRewardPreference })
        .from(user)
        .where(eq(user.id, inviterId))
        .limit(1);
      const pref = inviter[0]?.pref ?? "xp";

      // 2. Attempt shield grant FIRST when preferred. Race-safe via predicate-in-WHERE.
      let actualReward: "xp" | "shield" = "xp";
      if (pref === "shield") {
        const updated = await tx
          .update(user)
          .set({ streakShieldsAvailable: sql`${user.streakShieldsAvailable} + 1` })
          .where(and(eq(user.id, inviterId), lt(user.streakShieldsAvailable, MAX_STREAK_SHIELDS)))
          .returning({ id: user.id });
        if (updated.length > 0) actualReward = "shield";
      }

      // 3. XP path (either preferred or fell back from shield-cap).
      if (actualReward === "xp") {
        await tx
          .update(user)
          .set({ totalXp: sql`${user.totalXp} + 100` })
          .where(eq(user.id, inviterId));
      }

      // 4. Audit row with the TRUTH (post-fallback).
      await tx.insert(invitationAcceptance).values({ inviterId, inviteeId, rewardType: actualReward });

      // 5. Friendship (unchanged).
      await tx.insert(friendship).values({
        requesterId: inviterId,
        recipientId: inviteeId,
        status: "accepted",
        acceptedAt: new Date(),
      });

      return { rewardType: actualReward, xpAwarded: actualReward === "xp" ? 100 : 0, shieldGranted: actualReward === "shield" };
    });
  }
}
