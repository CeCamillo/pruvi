import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

// Point @pruvi/db at the test database so that the route-level singleton
// (new RoletaRepository(db)) operates on pruvi_test, not pruvi.
// The factory is hoisted by vitest so we cannot reference variables defined
// outside — everything must be constructed inline.
vi.mock("@pruvi/db", async () => {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("@pruvi/db/schema/index");
  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:password@localhost:5432/pruvi_test";
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
  const db = drizzle(pool, { schema: schema });
  return { db, pool };
});

// Stub auth so every request is authenticated as "u1".
vi.mock("better-auth/node", () => ({
  fromNodeHeaders: vi.fn((h: unknown) => h),
}));

vi.mock("@pruvi/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "u1" },
        session: {},
      }),
    },
  },
}));

import {
  setupTestDb,
  cleanupTestDb,
  teardownTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { buildApp } from "../../index";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { dailySession } from "@pruvi/db/schema/daily-sessions";

describe("roleta routes (integration)", () => {
  const db = getTestDb();
  let app: FastifyInstance;

  beforeAll(async () => {
    await setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    // Clear the roleta config cache so a stale Redis entry from a prior run
    // does not bleed into this test.
    await app.cache.del("roleta-config:u1");
    await cleanupTestDb();
    await db.insert(user).values({
      id: "u1",
      name: "Test",
      email: "u1@test.com",
      emailVerified: false,
      updatedAt: new Date(),
    });
    const [subj] = await db
      .insert(subject)
      .values({ slug: "matematica", name: "Matemática" })
      .returning();
    const values = Array.from({ length: 5 }, (_, i) => ({
      subjectId: subj!.id,
      body: `Q${i + 1}`,
      options: ["a", "b", "c", "d"],
      correctOptionIndex: 0,
      difficulty: 1,
      requiresCalculation: false,
    }));
    await db.insert(question).values(values);
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDb();
  });

  it("spin then answer ×3 — xp grows, no lives change, no daily_session, 3 review_log rows", async () => {
    const spinRes = await app.inject({ method: "POST", url: "/roleta/spin" });
    expect(spinRes.statusCode).toBe(200);
    const { data: spin } = spinRes.json();
    expect(spin.questions).toHaveLength(3);

    // Answer all 3 correctly.
    let totalXp = 0;
    for (const q of spin.questions) {
      const res = await app.inject({
        method: "POST",
        url: "/roleta/answer",
        payload: {
          spinId: spin.spinId,
          questionId: q.id,
          selectedOptionIndex: 0,
        },
      });
      expect(res.statusCode).toBe(200);
      const { data: answer } = res.json();
      expect(answer.correct).toBe(true);
      totalXp += answer.xpAwarded;
    }

    // All answers were easy correct → floor(10/2) = 5 each.
    expect(totalXp).toBe(15);

    const userRows = await db
      .select({ totalXp: user.totalXp, lives: user.lives })
      .from(user)
      .where(eq(user.id, "u1"));
    expect(userRows[0]!.totalXp).toBe(15);
    expect(userRows[0]!.lives).toBe(5); // unchanged

    const dailyRows = await db.select().from(dailySession);
    expect(dailyRows).toHaveLength(0);

    const reviewRows = await db
      .select()
      .from(reviewLog)
      .where(eq(reviewLog.userId, "u1"));
    expect(reviewRows).toHaveLength(3);
    for (const r of reviewRows) {
      expect(r.source).toBe("roleta");
      expect(r.nextReviewAt).toBeNull();
    }
  });

  it("GET /roleta/config falls back to all slugs when user has none", async () => {
    const res = await app.inject({ method: "GET", url: "/roleta/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.subjects).toEqual(["matematica"]);
  });

  it("PUT /roleta/config rejects unknown slug with 400", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/roleta/config",
      payload: { subjects: ["ghost"] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("PUT /roleta/config persists and subsequent GET reflects it", async () => {
    // Seed a second subject so there's something to store.
    await db.insert(subject).values({ slug: "biologia", name: "Biologia" });

    const put = await app.inject({
      method: "PUT",
      url: "/roleta/config",
      payload: { subjects: ["biologia"] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().data.subjects).toEqual(["biologia"]);

    const get = await app.inject({ method: "GET", url: "/roleta/config" });
    expect(get.statusCode).toBe(200);
    expect(get.json().data.subjects).toEqual(["biologia"]);
  });
});
