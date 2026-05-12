import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../../test/db-helpers";
import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import { friendship } from "@pruvi/db/schema/friendship";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { FriendshipsRepository } from "./friendships.repository";

describe("FriendshipsRepository (integration)", () => {
  const db = getTestDb();
  const repo = new FriendshipsRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function insertUser(id: string, opts?: { username?: string; inviteCode?: string }) {
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

  describe("findByUsername", () => {
    it("finds a user by username (case-insensitive)", async () => {
      await insertUser("user-a", { username: "alice" });
      const result = await repo.findByUsername("ALICE");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("user-a");
    });

    it("returns null for unknown username", async () => {
      const result = await repo.findByUsername("nobody");
      expect(result).toBeNull();
    });
  });

  describe("findExistingPair", () => {
    it("finds pair regardless of order (a,b) vs (b,a)", async () => {
      await insertUser("user-1");
      await insertUser("user-2");
      await db.insert(friendship).values({
        requesterId: "user-1",
        recipientId: "user-2",
        status: "pending",
      });

      const result1 = await repo.findExistingPair("user-1", "user-2");
      const result2 = await repo.findExistingPair("user-2", "user-1");

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1?.id).toBe(result2?.id);
    });
  });

  describe("createRequest", () => {
    it("inserts a pending friendship and returns the row", async () => {
      await insertUser("req-1");
      await insertUser("rec-1");

      const row = await repo.createRequest("req-1", "rec-1");

      expect(row.status).toBe("pending");
      expect(row.requesterId).toBe("req-1");
      expect(row.recipientId).toBe("rec-1");
    });
  });

  describe("pair UNIQUE index (LEAST/GREATEST)", () => {
    it("prevents inserting reverse duplicate (a,b) then (b,a)", async () => {
      await insertUser("pair-a");
      await insertUser("pair-b");

      await db.insert(friendship).values({
        requesterId: "pair-a",
        recipientId: "pair-b",
        status: "pending",
      });

      await expect(
        db.insert(friendship).values({
          requesterId: "pair-b",
          recipientId: "pair-a",
          status: "pending",
        }),
      ).rejects.toThrow();
    });
  });

  describe("no-self-friendship CHECK", () => {
    it("rejects inserting a friendship where requester equals recipient", async () => {
      await insertUser("solo-1");

      await expect(
        db.insert(friendship).values({
          requesterId: "solo-1",
          recipientId: "solo-1",
          status: "pending",
        }),
      ).rejects.toThrow();
    });
  });

  describe("status CHECK", () => {
    it("rejects invalid status values", async () => {
      await insertUser("st-1");
      await insertUser("st-2");

      await expect(
        db.execute(
          // Use raw SQL to bypass Drizzle's enum typing
          // @ts-ignore
          `INSERT INTO friendship (requester_id, recipient_id, status) VALUES ('st-1', 'st-2', 'unknown')`,
        ),
      ).rejects.toThrow();
    });
  });

  describe("getRequest", () => {
    it("returns request when it belongs to recipient and is pending", async () => {
      await insertUser("sender-x");
      await insertUser("recip-x");
      const created = await repo.createRequest("sender-x", "recip-x");

      const result = await repo.getRequest(created.id, "recip-x");
      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
    });

    it("returns null when request belongs to different recipient", async () => {
      await insertUser("sender-y");
      await insertUser("recip-y");
      await insertUser("other-y");
      const created = await repo.createRequest("sender-y", "recip-y");

      const result = await repo.getRequest(created.id, "other-y");
      expect(result).toBeNull();
    });
  });

  describe("respond", () => {
    it("updates status to accepted and sets acceptedAt", async () => {
      await insertUser("s1");
      await insertUser("r1");
      const created = await repo.createRequest("s1", "r1");

      await repo.respond(created.id, "accept");

      const [updated] = await db
        .select()
        .from(friendship)
        .where(eq(friendship.id, created.id));
      expect(updated?.status).toBe("accepted");
      expect(updated?.acceptedAt).not.toBeNull();
      expect(updated?.acceptedAt).toBeInstanceOf(Date);
    });

    it("updates status to declined and leaves acceptedAt null", async () => {
      await insertUser("s2");
      await insertUser("r2");
      const created = await repo.createRequest("s2", "r2");

      await repo.respond(created.id, "decline");

      const [updated] = await db
        .select()
        .from(friendship)
        .where(eq(friendship.id, created.id));
      expect(updated?.status).toBe("declined");
      expect(updated?.acceptedAt).toBeNull();
    });
  });

  describe("listAcceptedFriendsWithUserData", () => {
    it("returns the other party when current user is the requester", async () => {
      await insertUser("me-1", { username: "me1" });
      await insertUser("friend-1", { username: "friend1" });
      const req = await repo.createRequest("me-1", "friend-1");
      await repo.respond(req.id, "accept");

      const friends = await repo.listAcceptedFriendsWithUserData("me-1");
      expect(friends).toHaveLength(1);
      expect(friends[0]?.id).toBe("friend-1");
    });

    it("returns the other party when current user is the recipient", async () => {
      await insertUser("me-2", { username: "me2" });
      await insertUser("friend-2", { username: "friend2" });
      const req = await repo.createRequest("friend-2", "me-2");
      await repo.respond(req.id, "accept");

      const friends = await repo.listAcceptedFriendsWithUserData("me-2");
      expect(friends).toHaveLength(1);
      expect(friends[0]?.id).toBe("friend-2");
    });
  });

  describe("listIncomingRequests", () => {
    it("returns pending requests where user is recipient", async () => {
      await insertUser("sender-req");
      await insertUser("recip-req");
      await repo.createRequest("sender-req", "recip-req");

      const requests = await repo.listIncomingRequests("recip-req");
      expect(requests).toHaveLength(1);
      expect(requests[0]?.from.id).toBe("sender-req");
    });

    it("does not return requests where user is the sender", async () => {
      await insertUser("sender-req2");
      await insertUser("recip-req2");
      await repo.createRequest("sender-req2", "recip-req2");

      const requests = await repo.listIncomingRequests("sender-req2");
      expect(requests).toHaveLength(0);
    });
  });

  describe("deletePair", () => {
    it("deletes friendship regardless of which user is requester vs recipient", async () => {
      await insertUser("del-a");
      await insertUser("del-b");
      await db.insert(friendship).values({
        requesterId: "del-a",
        recipientId: "del-b",
        status: "accepted",
        acceptedAt: new Date(),
      });

      // deletePair called with (b, a) — reversed order — should still delete
      await repo.deletePair("del-b", "del-a");

      const pair = await repo.findExistingPair("del-a", "del-b");
      expect(pair).toBeNull();
    });
  });

  /** Seed a question so review_log rows can be inserted. Returns questionId. */
  async function seedQuestion(): Promise<number> {
    const [subj] = await db
      .insert(subject)
      .values({ name: "Math", slug: "math" })
      .returning();
    const [t] = await db
      .insert(topic)
      .values({
        subjectId: subj!.id,
        name: "Algebra",
        slug: "algebra",
        displayOrder: 0,
      })
      .returning();
    const [st] = await db
      .insert(subtopic)
      .values({
        topicId: t!.id,
        name: "Basics",
        slug: "basics",
        displayOrder: 0,
      })
      .returning();
    const [q] = await db
      .insert(question)
      .values({
        subjectId: subj!.id,
        subtopicId: st!.id,
        content: "1+1?",
        options: ["1", "2", "3", "4"],
        correctOptionIndex: 1,
        difficulty: "easy" as const,
        requiresCalculation: false,
      })
      .returning();
    return q!.id;
  }

  async function insertReviewLog(
    userId: string,
    questionId: number,
    xpEarned: number,
    reviewedAt: Date,
  ) {
    await db.insert(reviewLog).values({
      userId,
      questionId,
      quality: 4,
      easinessFactor: "2.50",
      interval: 1,
      repetitions: 1,
      xpEarned,
      nextReviewAt: new Date(reviewedAt.getTime() + 24 * 60 * 60 * 1000),
      reviewedAt,
    });
  }

  async function makeFriendship(aId: string, bId: string) {
    await db.insert(friendship).values({
      requesterId: aId,
      recipientId: bId,
      status: "accepted",
      acceptedAt: new Date(),
    });
  }

  describe("findOvertakenFriendIds", () => {
    it("returns friends with weekly XP in [previousWeeklyXp, newWeeklyXp)", async () => {
      await insertUser("ot-me-001");
      await insertUser("ot-fa-002");
      await insertUser("ot-fb-003");
      await insertUser("ot-fc-004");
      await insertUser("ot-nf-005");

      await makeFriendship("ot-me-001", "ot-fa-002");
      await makeFriendship("ot-me-001", "ot-fb-003");
      await makeFriendship("ot-me-001", "ot-fc-004");

      const questionId = await seedQuestion();
      const weekStart = new Date("2026-05-11T03:00:00.000Z");
      const currentWeekDate = new Date("2026-05-13T10:00:00.000Z");

      // ot-fa-002: 25 XP (in range [20, 50))
      await insertReviewLog("ot-fa-002", questionId, 25, currentWeekDate);
      // ot-fb-003: 50 XP (NOT - upper bound exclusive)
      await insertReviewLog("ot-fb-003", questionId, 50, currentWeekDate);
      // ot-fc-004: 15 XP (NOT - below previousWeeklyXp=20)
      await insertReviewLog("ot-fc-004", questionId, 15, currentWeekDate);
      // ot-nf-005: 25 XP (NOT - not a friend)
      await insertReviewLog("ot-nf-005", questionId, 25, currentWeekDate);

      const result = await repo.findOvertakenFriendIds("ot-me-001", weekStart, 20, 50);

      expect(result).toHaveLength(1);
      expect(result[0]!.friendId).toBe("ot-fa-002");
      expect(result[0]!.weeklyXp).toBe(25);
    });

    it("lower bound is inclusive", async () => {
      await insertUser("me-lb");
      await insertUser("friend-lb");

      await makeFriendship("me-lb", "friend-lb");

      const questionId = await seedQuestion();
      const weekStart = new Date("2026-05-11T03:00:00.000Z");
      const currentWeekDate = new Date("2026-05-13T10:00:00.000Z");

      // friend-lb at exactly previousWeeklyXp=20 → should be returned
      await insertReviewLog("friend-lb", questionId, 20, currentWeekDate);

      const result = await repo.findOvertakenFriendIds("me-lb", weekStart, 20, 50);

      expect(result).toHaveLength(1);
      expect(result[0]!.friendId).toBe("friend-lb");
      expect(result[0]!.weeklyXp).toBe(20);
    });

    it("returns empty array when newWeeklyXp <= previousWeeklyXp", async () => {
      const result = await repo.findOvertakenFriendIds("me-eq", new Date(), 50, 50);
      expect(result).toEqual([]);
    });

    it("returns empty array when user has no friends", async () => {
      const result = await repo.findOvertakenFriendIds("solo", new Date(), 0, 100);
      expect(result).toEqual([]);
    });
  });

  describe("getWeeklyXp", () => {
    it("sums xp_earned for the user within the week", async () => {
      await insertUser("me-xp");

      const questionId = await seedQuestion();
      const weekStart = new Date("2026-05-11T03:00:00.000Z");
      const currentWeekDate = new Date("2026-05-13T10:00:00.000Z");
      const lastWeekDate = new Date("2026-05-08T10:00:00.000Z");

      // 30 XP this week
      await insertReviewLog("me-xp", questionId, 30, currentWeekDate);
      // 100 XP last week (should NOT be counted)
      await insertReviewLog("me-xp", questionId, 100, lastWeekDate);

      const result = await repo.getWeeklyXp("me-xp", weekStart);
      expect(result).toBe(30);
    });

    it("returns 0 when user has no reviews", async () => {
      const result = await repo.getWeeklyXp("solo-xp", new Date());
      expect(result).toBe(0);
    });
  });
});
