import "dotenv/config";
import * as dotenv from "dotenv";
import * as path from "path";
import * as url from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";

// Schema imports use relative paths so this script runs without
// needing @pruvi/db to be installed at the repo root.
import { user } from "../packages/db/src/schema/auth.js";
import { question } from "../packages/db/src/schema/questions.js";
import { dailySession } from "../packages/db/src/schema/daily-sessions.js";
import { reviewLog } from "../packages/db/src/schema/review-log.js";
import { subject } from "../packages/db/src/schema/subjects.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Fallback: load from apps/server/.env when no root .env exists
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../apps/server/.env") });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool);

async function main() {
  console.log("→ Smoke test: representative query per table");

  const subjects = await db.select().from(subject).limit(1);
  console.log(`  subject rows: ${subjects.length}`);

  const questions = await db
    .select({
      id: question.id,
      content: question.content,
      difficulty: question.difficulty,
    })
    .from(question)
    .limit(1);
  console.log(`  question rows: ${questions.length} (difficulty=${questions[0]?.difficulty})`);

  const users = await db
    .select({
      id: user.id,
      lives: user.lives,
      totalXp: user.totalXp,
      currentLevel: user.currentLevel,
    })
    .from(user)
    .limit(1);
  console.log(`  user rows: ${users.length}`);

  if (users[0]) {
    const inserted = await db
      .insert(dailySession)
      .values({ userId: users[0].id, status: "active" })
      .returning();
    console.log(`  daily_session insert ok: status=${inserted[0]?.status}`);
    if (inserted[0]) {
      await db.delete(dailySession).where(eq(dailySession.id, inserted[0].id));
    }
  } else {
    console.log("  daily_session insert skipped (no user rows)");
  }

  const reviews = await db.select().from(reviewLog).limit(1);
  console.log(`  review_log rows: ${reviews.length}`);

  await pool.end();
  console.log("✓ Migration smoke test passed");
}

main().catch((err) => {
  console.error("✗ Smoke test failed:", err);
  process.exit(1);
});
