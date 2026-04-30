import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { FastifyInstance } from "fastify";

// Point @pruvi/db at the test database so that the route-level singleton
// (new MeRepository(db)) operates on pruvi_test, not pruvi.
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

describe("GET /me (integration)", () => {
  const db = getTestDb();
  let app: FastifyInstance;

  beforeAll(async () => {
    await setupTestDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    await app.cache.del("me:u1");
    await cleanupTestDb();
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDb();
  });

  it("returns 401 without a session", async () => {
    // Temporarily override the auth mock to return no session
    const { auth } = await import("@pruvi/auth");
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never);

    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns the full bundle for an authenticated user", async () => {
    await db.insert(user).values({
      id: "u1",
      name: "Cesar",
      email: "u1@test.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(200);

    const { data } = res.json();
    expect(data).toMatchObject({
      id: "u1",
      name: "Cesar",
      email: "u1@test.com",
      plan: expect.any(String),
      totalXp: expect.any(Number),
      weeklyXp: expect.any(Number),
      currentLevel: expect.any(Number),
      xpForNextLevel: expect.any(Number),
      currentStreak: expect.any(Number),
      longestStreak: expect.any(Number),
      lives: expect.any(Number),
      onboardingCompleted: expect.any(Boolean),
    });
  });

  it("returns 404 when user does not exist", async () => {
    // User "u1" is not seeded — getProfile returns null
    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(404);
  });

  it("returns a cached response on the second call within TTL", async () => {
    await db.insert(user).values({
      id: "u1",
      name: "Cached User",
      email: "u1@test.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    // First call — cache miss, populates cache
    const res1 = await app.inject({ method: "GET", url: "/me" });
    expect(res1.statusCode).toBe(200);

    // Second call — should hit cache (same data returned)
    const res2 = await app.inject({ method: "GET", url: "/me" });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().data).toEqual(res1.json().data);

    // Verify the cache key is now populated
    const cached = await app.cache.get("me:u1");
    expect(cached).not.toBeNull();
  });
});
