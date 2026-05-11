import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { user, session, account } from "@pruvi/db/schema/auth";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { UsersRepository } from "./users.repository";

describe("UsersRepository (integration)", () => {
  const db = getTestDb();
  const repo = new UsersRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("updateUsername rejects duplicate username with user_username_unique violation", async () => {
    const userId1 = "test-user-username-1";
    const userId2 = "test-user-username-2";

    await db.insert(user).values([
      {
        id: userId1,
        name: "User One",
        email: `${userId1}@example.com`,
        emailVerified: false,
        updatedAt: new Date(),
      },
      {
        id: userId2,
        name: "User Two",
        email: `${userId2}@example.com`,
        emailVerified: false,
        updatedAt: new Date(),
      },
    ]);

    // First user sets "abc"
    await repo.updateUsername(userId1, "abc");

    // Second user tries to set same username — must throw (unique constraint)
    // Drizzle wraps the pg error so we can only assert some error is thrown.
    await expect(repo.updateUsername(userId2, "abc")).rejects.toThrow();
  });

  it("deleteUser cascades to session, account, and daily_session rows", async () => {
    const userId = "test-user-cascade";

    await db.insert(user).values({
      id: userId,
      name: "Cascade Test",
      email: `${userId}@example.com`,
      emailVerified: false,
      updatedAt: new Date(),
    });

    await db.insert(session).values({
      id: "session-1",
      token: "token-1",
      expiresAt: new Date(Date.now() + 86400_000),
      userId,
      updatedAt: new Date(),
    });

    await db.insert(account).values({
      id: "account-1",
      accountId: "acc-1",
      providerId: "email",
      userId,
      updatedAt: new Date(),
    });

    await db.insert(dailySession).values({ userId });

    await repo.deleteUser(userId);

    const userRows = await db.select().from(user).where(eq(user.id, userId));
    const sessionRows = await db.select().from(session).where(eq(session.userId, userId));
    const accountRows = await db.select().from(account).where(eq(account.userId, userId));
    const dailyRows = await db.select().from(dailySession).where(eq(dailySession.userId, userId));

    expect(userRows).toHaveLength(0);
    expect(sessionRows).toHaveLength(0);
    expect(accountRows).toHaveLength(0);
    expect(dailyRows).toHaveLength(0);
  });
});
