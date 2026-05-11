import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, getTestDb, teardownTestDb, cleanupTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { pushToken } from "@pruvi/db/schema/push-tokens";
import { TokensRepository } from "./tokens.repository";

const db = getTestDb();
const repo = new TokensRepository(db);

const USER_A = "user_tokens_a";
const USER_B = "user_tokens_b";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanupTestDb();
  await db.insert(user).values([
    { id: USER_A, name: "A", email: `${USER_A}@x.com` },
    { id: USER_B, name: "B", email: `${USER_B}@x.com` },
  ]);
});

describe("TokensRepository.upsert", () => {
  it("inserts a new token for a user", async () => {
    const row = await repo.upsert(USER_A, "ExponentPushToken[a]", "ios");
    expect(row.userId).toBe(USER_A);
    expect(row.token).toBe("ExponentPushToken[a]");
    expect(row.platform).toBe("ios");
  });

  it("re-registering the same token under a different user reassigns it (no duplicates)", async () => {
    await repo.upsert(USER_A, "ExponentPushToken[shared]", "ios");
    const second = await repo.upsert(USER_B, "ExponentPushToken[shared]", "ios");
    expect(second.userId).toBe(USER_B);
    const rows = await db.select().from(pushToken).where(eq(pushToken.token, "ExponentPushToken[shared]"));
    expect(rows).toHaveLength(1);
  });

  it("listByUser returns only that user's tokens", async () => {
    await repo.upsert(USER_A, "ExponentPushToken[a1]", "ios");
    await repo.upsert(USER_A, "ExponentPushToken[a2]", "android");
    await repo.upsert(USER_B, "ExponentPushToken[b1]", "ios");
    const rows = await repo.listByUser(USER_A);
    expect(rows.map((r) => r.token).sort()).toEqual(["ExponentPushToken[a1]", "ExponentPushToken[a2]"]);
  });

  it("deleteForUser removes only when owned by that user", async () => {
    await repo.upsert(USER_A, "ExponentPushToken[a]", "ios");
    await repo.upsert(USER_B, "ExponentPushToken[b]", "ios");
    await repo.deleteForUser(USER_A, "ExponentPushToken[b]");
    const bRows = await db.select().from(pushToken).where(eq(pushToken.token, "ExponentPushToken[b]"));
    expect(bRows).toHaveLength(1);

    await repo.deleteForUser(USER_A, "ExponentPushToken[a]");
    const aRows = await db.select().from(pushToken).where(eq(pushToken.token, "ExponentPushToken[a]"));
    expect(aRows).toHaveLength(0);
  });

  it("deleteTokens removes a set of tokens regardless of owner (receipt pruning)", async () => {
    await repo.upsert(USER_A, "ExponentPushToken[x]", "ios");
    await repo.upsert(USER_B, "ExponentPushToken[y]", "ios");
    await repo.deleteTokens(["ExponentPushToken[x]", "ExponentPushToken[y]"]);
    const rows = await db.select().from(pushToken);
    expect(rows).toHaveLength(0);
  });
});
