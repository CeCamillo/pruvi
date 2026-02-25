# DB-TDD — Drizzle + PGLite

## Pattern

Test through the **service interface**, not raw queries.

## Setup

```typescript
import { createTestDb } from "@pruvi/db/test-client";

let db: Awaited<ReturnType<typeof createTestDb>>["db"];
let client: Awaited<ReturnType<typeof createTestDb>>["client"];

beforeEach(async () => {
  const testDb = await createTestDb();
  db = testDb.db;
  client = testDb.client;
});

afterEach(async () => {
  await client.close();
});
```

## Rules

1. **Service receives `db` as first argument** — dependency injection, no global imports
2. **Each test seeds its own data** — no shared state between tests
3. **One test at a time**: write RED test → make it GREEN → write next test
4. **Test the service function**, not the SQL — the service is the public API
5. **No mocking Drizzle** — PGLite is a real PostgreSQL, use it

## Example

```typescript
// Service function
export async function getNextQuestion(db: Database, userId: string) {
  // query logic here
}

// Test
it("returns unseen questions first", async () => {
  // seed: user, subject, question
  const result = await getNextQuestion(db, userId);
  expect(result).toBeDefined();
  expect(result.id).toBe(seededQuestionId);
});
```

## File Structure

```
apps/server/src/features/questions/
├── questions.service.ts       # Business logic (receives db)
├── questions.routes.ts        # Fastify route handlers (thin)
└── __tests__/
    └── questions.service.test.ts
```
