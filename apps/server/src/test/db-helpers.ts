import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@pruvi/db/schema/index";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:password@localhost:5432/pruvi_test";

let pool: Pool | null = null;

/** Get the test database pool (lazy-initialized). */
export function getTestPool() {
  if (!pool) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
  }
  return pool;
}

/** Get a Drizzle client connected to the test database. */
export function getTestDb() {
  return drizzle(getTestPool(), { schema });
}

/** Push schema to test database by applying every migration in order. */
export async function setupTestDb() {
  const testPool = getTestPool();

  // Reset schema to ensure a clean slate — handles migration consolidations
  // and schema drift between test runs.
  await testPool.query("DROP SCHEMA public CASCADE");
  await testPool.query("CREATE SCHEMA public");

  const migrationsDir = resolve(
    import.meta.dirname ?? ".",
    "../../../../packages/db/src/migrations"
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sqlText = readFileSync(resolve(migrationsDir, file), "utf-8");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await testPool.query(statement);
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
