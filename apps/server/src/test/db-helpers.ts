import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@pruvi/db/schema";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:password@localhost:5432/pruvi_test";

let pool: pg.Pool | null = null;

/** Get the test database pool (lazy-initialized). */
export function getTestPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
  }
  return pool;
}

/** Get a Drizzle client connected to the test database. */
export function getTestDb() {
  return drizzle(getTestPool(), { schema });
}

/** Push schema to test database using Drizzle's push. */
export async function setupTestDb() {
  const testPool = getTestPool();
  // Use drizzle-kit push programmatically isn't straightforward,
  // so we run the migration SQL directly
  const migrationSql = await Bun.file(
    new URL("../../../../packages/db/src/migrations/0000_tranquil_blockbuster.sql", import.meta.url)
  ).text();

  // Split by statement breakpoint and execute each
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await testPool.query(statement);
    } catch (err: unknown) {
      // Ignore "already exists" errors (idempotent setup)
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("already exists")) {
        throw err;
      }
    }
  }
}

/** Truncate all tables between tests (preserves schema). */
export async function cleanupTestDb() {
  const db = getTestDb();
  await db.execute(sql`
    TRUNCATE TABLE review_log, daily_session, question, subject,
      account, session, verification, "user" CASCADE
  `);
}

/** Close the test database pool. */
export async function teardownTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
