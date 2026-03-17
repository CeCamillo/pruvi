import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { SessionsRepository } from "./sessions.repository";
import { user } from "@pruvi/db/schema/auth";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { sql } from "drizzle-orm";

describe("SessionsRepository (integration)", () => {
  const db = getTestDb();
  const repo = new SessionsRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function seedUser(id = "test-user-1") {
    await db.insert(user).values({
      id,
      name: "Test",
      email: `${id}@test.com`,
      emailVerified: false,
      updatedAt: new Date(),
    });
  }

  describe("findTodaySession", () => {
    it("returns today's session for the user", async () => {
      await seedUser();
      await repo.createSession("test-user-1");

      const found = await repo.findTodaySession("test-user-1");

      expect(found).not.toBeNull();
      expect(found!.userId).toBe("test-user-1");
      expect(found!.status).toBe("active");
    });

    it("returns null when no session exists today", async () => {
      await seedUser();

      const found = await repo.findTodaySession("test-user-1");

      expect(found).toBeNull();
    });

    it("does not return a session from yesterday", async () => {
      await seedUser();

      // Insert a session and manually backdate its createdAt to yesterday
      const [session] = await db
        .insert(dailySession)
        .values({ userId: "test-user-1" })
        .returning();

      await db.execute(
        sql`UPDATE daily_session SET created_at = NOW() - INTERVAL '1 day' WHERE id = ${session.id}`
      );

      const found = await repo.findTodaySession("test-user-1");

      expect(found).toBeNull();
    });
  });

  describe("createSession + completeSession", () => {
    it("creates an active session and completes it", async () => {
      await seedUser();

      const created = await repo.createSession("test-user-1");

      expect(created).toBeDefined();
      expect(created.userId).toBe("test-user-1");
      expect(created.status).toBe("active");
      expect(created.questionCount).toBe(0);
      expect(created.correctCount).toBe(0);
      expect(created.completedAt).toBeNull();

      const completed = await repo.completeSession(created.id, 10, 8);

      expect(completed).toBeDefined();
      expect(completed.status).toBe("completed");
      expect(completed.questionCount).toBe(10);
      expect(completed.correctCount).toBe(8);
      expect(completed.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("findSessionById", () => {
    it("finds an existing session by ID", async () => {
      await seedUser();
      const created = await repo.createSession("test-user-1");

      const found = await repo.findSessionById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.userId).toBe("test-user-1");
    });

    it("returns null for a non-existent ID", async () => {
      const found = await repo.findSessionById(999999);

      expect(found).toBeNull();
    });
  });
});
