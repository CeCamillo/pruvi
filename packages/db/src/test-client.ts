import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "./schema";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      image TEXT,
      lives INTEGER NOT NULL DEFAULT 5,
      lives_reset_at TIMESTAMP,
      total_xp INTEGER NOT NULL DEFAULT 0,
      current_level INTEGER NOT NULL DEFAULT 1,
      selected_exam TEXT,
      exam_date DATE,
      difficulties TEXT[] NOT NULL DEFAULT '{}',
      daily_study_time_minutes INTEGER,
      onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY,
      expires_at TIMESTAMP NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "account" (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TIMESTAMP,
      refresh_token_expires_at TIMESTAMP,
      scope TEXT,
      password TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "subject" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "question" (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_option_index INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      requires_calculation BOOLEAN NOT NULL DEFAULT FALSE,
      source TEXT,
      subject_id INTEGER NOT NULL REFERENCES "subject"(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "review_log" (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES "question"(id),
      quality INTEGER NOT NULL,
      easiness_factor NUMERIC(4,2) NOT NULL,
      interval INTEGER NOT NULL,
      repetitions INTEGER NOT NULL,
      next_review_at TIMESTAMP NOT NULL,
      reviewed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "daily_session" (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active',
      questions_answered INTEGER NOT NULL DEFAULT 0,
      questions_correct INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  return { db, client };
}
