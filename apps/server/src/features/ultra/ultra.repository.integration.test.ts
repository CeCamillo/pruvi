import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { UltraRepository } from "./ultra.repository";

describe("UltraRepository (integration)", () => {
  const db = getTestDb();
  const repo = new UltraRepository(db);

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function insertUser(id: string) {
    await db.insert(user).values({
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      emailVerified: false,
      inviteCode: `code${id.replace(/-/g, "").slice(0, 8)}`,
      username: null,
      updatedAt: new Date(),
    });
  }

  describe("get", () => {
    it("returns null for missing user", async () => {
      const result = await repo.get("nonexistent-user");
      expect(result).toBeNull();
    });

    it("returns shape with defaults for existing user", async () => {
      await insertUser("user-get-1");
      const result = await repo.get("user-get-1");
      expect(result).not.toBeNull();
      expect(result?.isUltra).toBe(false);
      expect(result?.ultraExpiresAt).toBeNull();
    });
  });

  describe("grant", () => {
    it("sets isUltra=true and ultraExpiresAt for a user", async () => {
      await insertUser("user-grant-1");
      const expiresAt = new Date("2027-01-01T00:00:00.000Z");
      await repo.grant("user-grant-1", expiresAt);

      const result = await repo.get("user-grant-1");
      expect(result?.isUltra).toBe(true);
      expect(result?.ultraExpiresAt).toBeInstanceOf(Date);
      expect(result?.ultraExpiresAt?.toISOString()).toBe(expiresAt.toISOString());
    });
  });

  describe("revoke", () => {
    it("clears isUltra and ultraExpiresAt for an Ultra user", async () => {
      await insertUser("user-revoke-1");
      const expiresAt = new Date("2027-01-01T00:00:00.000Z");
      await repo.grant("user-revoke-1", expiresAt);

      // Confirm it's set
      const before = await repo.get("user-revoke-1");
      expect(before?.isUltra).toBe(true);

      // Revoke
      await repo.revoke("user-revoke-1");

      const after = await repo.get("user-revoke-1");
      expect(after?.isUltra).toBe(false);
      expect(after?.ultraExpiresAt).toBeNull();
    });
  });

  describe("CHECK constraint: ultra_expires_at requires is_ultra=true", () => {
    it("throws when setting ultra_expires_at non-null while is_ultra=false", async () => {
      await insertUser("user-chk-1");

      // Attempt to set ultra_expires_at without setting is_ultra=true
      await expect(
        db.execute(
          // Use raw SQL to bypass Drizzle's type system — simulates a bad direct DB write
          // @ts-ignore
          `UPDATE "user" SET ultra_expires_at = '2027-01-01T00:00:00.000Z' WHERE id = 'user-chk-1'`,
        ),
      ).rejects.toThrow();
    });
  });
});
