# Phase 2B — Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the push-notification pipeline (Expo) for scheduled streak reminders (19h + 21h BRT) and achievement notifications (7d/30d streak, "quase mestre" mastery), with per-type opt-out and device token storage.

**Architecture:** New `push_token` table + 3 user pref columns. New `notifications` feature module with Expo Push API wrapper, tokens/preferences CRUD endpoints, dispatcher service, and a worker handling two BullMQ queues: `notifications-cron` (hourly sweep) and `notifications-send` (batched fan-out). Achievement events hook from `sessions.service.completeSession` post-success.

**Tech Stack:** Drizzle ORM · BullMQ · `expo-server-sdk` · Fastify 5 · Vitest + PGlite · neverthrow `Result<T, AppError>`.

**Spec:** `docs/superpowers/specs/2026-05-10-phase-2b-push-notifications-design.md`

---

## File Map

**Create:**
- `packages/shared/src/notifications.ts` — Zod schemas
- `packages/db/src/schema/push-tokens.ts` — Drizzle schema
- `packages/db/src/migrations/0004_<adjective>_<noun>.sql` — drizzle-kit generated, hand-checked
- `apps/server/src/features/notifications/index.ts`
- `apps/server/src/features/notifications/push.client.ts` — Expo SDK wrapper
- `apps/server/src/features/notifications/templates.ts` — PT-BR message builders
- `apps/server/src/features/notifications/dispatcher.ts` — orchestration
- `apps/server/src/features/notifications/tokens.repository.ts`
- `apps/server/src/features/notifications/tokens.service.ts`
- `apps/server/src/features/notifications/tokens.route.ts`
- `apps/server/src/features/notifications/preferences.repository.ts`
- `apps/server/src/features/notifications/preferences.service.ts`
- `apps/server/src/features/notifications/preferences.route.ts`
- `apps/server/src/features/notifications/templates.test.ts`
- `apps/server/src/features/notifications/push.client.test.ts`
- `apps/server/src/features/notifications/dispatcher.test.ts`
- `apps/server/src/features/notifications/tokens.service.test.ts`
- `apps/server/src/features/notifications/preferences.service.test.ts`
- `apps/server/src/features/notifications/tokens.repository.integration.test.ts`
- `apps/server/src/features/notifications/notifications.sweep.integration.test.ts`
- `apps/server/src/workers/notifications.worker.ts`

**Modify:**
- `packages/shared/src/index.ts` — re-export notifications
- `packages/db/src/schema/auth.ts` — add 3 user notification columns
- `packages/db/src/schema/index.ts` — re-export push-tokens
- `packages/db/src/test-client.ts` — mirror DDL
- `packages/env/src/server.ts` — add `EXPO_ACCESS_TOKEN`
- `apps/server/package.json` — add `expo-server-sdk` dep
- `apps/server/src/plugins/queue.ts` — register 2 new queues + repeatable cron
- `apps/server/src/worker.ts` — start notifications worker alongside prefetch
- `apps/server/src/index.ts` — register tokens + preferences routes
- `apps/server/src/features/sessions/sessions.service.ts` — fire achievement notifications post-complete

---

## Task 1: Shared Zod schemas

**Files:**
- Create: `packages/shared/src/notifications.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create schemas**

```typescript
import { z } from "zod";

export const PushPlatformSchema = z.enum(["ios", "android"]);
export type PushPlatform = z.infer<typeof PushPlatformSchema>;

export const RegisterPushTokenBodySchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, {
    message: "Invalid Expo push token format",
  }),
  platform: PushPlatformSchema,
});
export type RegisterPushTokenBody = z.infer<typeof RegisterPushTokenBodySchema>;

export const PushTokenResponseSchema = z.object({
  id: z.number().int().positive(),
  token: z.string(),
  platform: PushPlatformSchema,
});

export const NotificationPreferencesSchema = z.object({
  notificationHour: z.number().int().min(0).max(23),
  streakRemindersEnabled: z.boolean(),
  achievementNotificationsEnabled: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesBodySchema = NotificationPreferencesSchema.partial();
export type UpdateNotificationPreferencesBody = z.infer<typeof UpdateNotificationPreferencesBodySchema>;
```

- [ ] **Step 2: Re-export**

In `packages/shared/src/index.ts`, append:
```typescript
export * from "./notifications";
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @pruvi/shared check-types
git add packages/shared/src/notifications.ts packages/shared/src/index.ts
git commit -m "feat(shared): notifications zod schemas"
```

---

## Task 2: Drizzle schema — push_token + user columns

**Files:**
- Create: `packages/db/src/schema/push-tokens.ts`
- Modify: `packages/db/src/schema/auth.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create push_token schema**

`packages/db/src/schema/push-tokens.ts`:

```typescript
import { relations } from "drizzle-orm";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const pushToken = pgTable(
  "push_token",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform", { enum: ["ios", "android"] }).notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("push_token_user_idx").on(table.userId),
  ],
);

export const pushTokenRelations = relations(pushToken, ({ one }) => ({
  user: one(user, {
    fields: [pushToken.userId],
    references: [user.id],
  }),
}));
```

- [ ] **Step 2: Extend user schema with notification columns**

In `packages/db/src/schema/auth.ts`, inside the `user` `pgTable({...})` object, add (before `createdAt`):

```typescript
notificationHour: integer("notification_hour").notNull().default(19),
streakRemindersEnabled: boolean("streak_reminders_enabled").notNull().default(true),
achievementNotificationsEnabled: boolean("achievement_notifications_enabled").notNull().default(true),
```

- [ ] **Step 3: Re-export**

In `packages/db/src/schema/index.ts`, append after the topics re-export:
```typescript
export * from "./push-tokens";
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @pruvi/db check-types
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/
git commit -m "feat(db): push_token table + user notification columns"
```

---

## Task 3: Migration 0004

**Files:**
- Create: `packages/db/src/migrations/0004_<name>.sql` (drizzle-kit)

- [ ] **Step 1: Start pg + generate**

```bash
pnpm db:start
pnpm --filter @pruvi/db db:generate
```

A new `0004_*.sql` appears with: `CREATE TABLE push_token` + `ALTER TABLE user ADD COLUMN ...` (×3).

- [ ] **Step 2: Inspect + add CHECK constraint**

Open the generated SQL. Append (or insert after the user ALTERs):

```sql
ALTER TABLE "user" ADD CONSTRAINT "user_notification_hour_chk" CHECK ("notification_hour" BETWEEN 0 AND 23);
```

Use `--> statement-breakpoint` between statements as the existing migrations do.

- [ ] **Step 3: Apply + smoke**

```bash
pnpm --filter @pruvi/db db:migrate
pnpm verify:migration
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/migrations/
git commit -m "feat(db): migration 0004 — push_token + user notification prefs"
```

---

## Task 4: PGlite test client mirror

**Files:**
- Modify: `packages/db/src/test-client.ts`

- [ ] **Step 1: Add user columns + push_token**

In the SQL template, modify the existing `"user"` CREATE TABLE to include the new columns:

```sql
notification_hour INTEGER NOT NULL DEFAULT 19,
streak_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
achievement_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
```

Add after the `daily_session` block (after the topics tables — order doesn't matter for push_token since it only depends on user):

```sql
    CREATE TABLE IF NOT EXISTS "push_token" (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      last_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
```

- [ ] **Step 2: Update cleanup helper**

In `apps/server/src/test/db-helpers.ts`, `cleanupTestDb` (or whatever TRUNCATE helper exists) — add `push_token` to the truncate list.

- [ ] **Step 3: Sanity test**

```bash
pnpm --filter server test
```
Expected: still passes (no new tests yet, just ensure existing tests still work with the modified DDL).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/test-client.ts apps/server/src/test/db-helpers.ts
git commit -m "chore(db): mirror push_token + user notification columns in pglite"
```

---

## Task 5: Env additions + expo-server-sdk dependency

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add env var**

In `packages/env/src/server.ts`, add to the `server` block:

```typescript
EXPO_ACCESS_TOKEN: z.string().optional(),
```

- [ ] **Step 2: Install dep**

```bash
pnpm --filter server add expo-server-sdk
```

Confirm `apps/server/package.json` now lists `"expo-server-sdk": "^3.x.x"` (or current latest).

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter server check-types
git add packages/env/src/server.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add expo-server-sdk + EXPO_ACCESS_TOKEN env"
```

---

## Task 6: Templates (`templates.ts`)

**Files:**
- Create: `apps/server/src/features/notifications/templates.ts`
- Create: `apps/server/src/features/notifications/templates.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from "vitest";
import {
  streakReminderPrimary,
  streakReminderLate,
  streakMilestone,
  masteryAchievement,
  type PushPayload,
} from "./templates";

describe("notification templates", () => {
  it("streakReminderPrimary returns non-empty PT-BR payload", () => {
    const p = streakReminderPrimary();
    expect(p.title).toMatch(/Pruvi/);
    expect(p.body.length).toBeGreaterThan(0);
  });

  it("streakReminderLate references risk to streak", () => {
    const p = streakReminderLate();
    expect(p.title.toLowerCase()).toContain("streak");
  });

  it("streakMilestone(7) and (30) produce different bodies", () => {
    const a = streakMilestone(7);
    const b = streakMilestone(30);
    expect(a.title).toMatch(/7/);
    expect(b.title).toMatch(/30/);
    expect(a.body).not.toEqual(b.body);
  });

  it("masteryAchievement includes the subtopic name", () => {
    const p = masteryAchievement("Membrana plasmática");
    expect(p.body).toContain("Membrana plasmática");
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
pnpm --filter server test templates.test
```
Expected: FAIL — cannot find `./templates`.

- [ ] **Step 3: Implement**

`apps/server/src/features/notifications/templates.ts`:

```typescript
export type PushPayload = {
  title: string;
  body: string;
};

export function streakReminderPrimary(): PushPayload {
  return {
    title: "A Pruvi te esperou hoje 💛",
    body: "Ainda dá tempo — 5 minutos é o suficiente.",
  };
}

export function streakReminderLate(): PushPayload {
  return {
    title: "Seu streak está em risco",
    body: "Uma sessão rápida segura o ritmo.",
  };
}

export function streakMilestone(days: 7 | 30): PushPayload {
  return {
    title: `${days} dias de streak! 🔥`,
    body:
      days === 7
        ? "Uma semana firme. Tá pegando o jeito."
        : "Um mês. Isso é dedicação real.",
  };
}

export function masteryAchievement(subtopicName: string): PushPayload {
  return {
    title: "Quase mestre! ⭐",
    body: `Você está dominando ${subtopicName}.`,
  };
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm --filter server test templates.test
```
Expected: PASS — all 4 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/notifications/templates.ts apps/server/src/features/notifications/templates.test.ts
git commit -m "feat(notifications): pt-br message templates"
```

---

## Task 7: Push client (Expo wrapper)

**Files:**
- Create: `apps/server/src/features/notifications/push.client.ts`
- Create: `apps/server/src/features/notifications/push.client.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { describe, expect, it, vi } from "vitest";
import { PushClient, EXPO_BATCH_SIZE } from "./push.client";

function makeExpoStub(overrides: Partial<{
  sendPushNotificationsAsync: ReturnType<typeof vi.fn>;
  isExpoPushToken: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    sendPushNotificationsAsync: overrides.sendPushNotificationsAsync ?? vi.fn().mockResolvedValue([]),
    isExpoPushToken: overrides.isExpoPushToken ?? vi.fn().mockReturnValue(true),
    chunkPushNotifications: (msgs: unknown[]) => [msgs],
  } as any;
}

describe("PushClient.sendBatch", () => {
  it("returns empty tickets when no tokens provided", async () => {
    const expo = makeExpoStub();
    const client = new PushClient(expo);
    const tickets = await client.sendBatch([], { title: "x", body: "y" });
    expect(tickets).toEqual([]);
    expect(expo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it("calls Expo with a properly shaped message per token", async () => {
    const sendMock = vi.fn().mockResolvedValue([{ status: "ok", id: "t1" }]);
    const expo = makeExpoStub({ sendPushNotificationsAsync: sendMock });
    const client = new PushClient(expo);
    await client.sendBatch(["ExponentPushToken[a]", "ExponentPushToken[b]"], {
      title: "T",
      body: "B",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const messages = sendMock.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ to: "ExponentPushToken[a]", title: "T", body: "B" });
  });

  it("filters out invalid tokens via isExpoPushToken", async () => {
    const expo = makeExpoStub({
      isExpoPushToken: vi.fn((t: string) => t.startsWith("ExponentPushToken")),
    });
    const client = new PushClient(expo);
    await client.sendBatch(["ExponentPushToken[a]", "bogus"], { title: "T", body: "B" });
    const messages = expo.sendPushNotificationsAsync.mock.calls[0][0];
    expect(messages).toHaveLength(1);
  });
});

describe("PushClient.pruneTokensFromTickets", () => {
  it("returns tokens whose ticket has DeviceNotRegistered detail", () => {
    const client = new PushClient(makeExpoStub());
    const tokens = ["ExponentPushToken[a]", "ExponentPushToken[b]"];
    const tickets = [
      { status: "ok", id: "t1" },
      { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
    ];
    const pruned = client.pruneTokensFromTickets(tokens, tickets as any);
    expect(pruned).toEqual(["ExponentPushToken[b]"]);
  });
});

it("EXPO_BATCH_SIZE is 100", () => {
  expect(EXPO_BATCH_SIZE).toBe(100);
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
pnpm --filter server test push.client.test
```
Expected: FAIL — cannot find `./push.client`.

- [ ] **Step 3: Implement**

`apps/server/src/features/notifications/push.client.ts`:

```typescript
import type Expo from "expo-server-sdk";
import type { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import type { PushPayload } from "./templates";

export const EXPO_BATCH_SIZE = 100;

export class PushClient {
  constructor(private expo: Expo) {}

  /** Send the same payload to a batch of tokens. Returns Expo tickets. */
  async sendBatch(tokens: string[], payload: PushPayload, data?: Record<string, unknown>): Promise<ExpoPushTicket[]> {
    if (tokens.length === 0) return [];

    const valid = tokens.filter((t) => this.expo.isExpoPushToken(t));
    if (valid.length === 0) return [];

    const messages: ExpoPushMessage[] = valid.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data,
      sound: "default" as const,
    }));

    return this.expo.sendPushNotificationsAsync(messages);
  }

  /** Inspect Expo tickets and return tokens that should be pruned (DeviceNotRegistered). */
  pruneTokensFromTickets(tokens: string[], tickets: ExpoPushTicket[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
        if (tokens[i]) out.push(tokens[i]);
      }
    }
    return out;
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm --filter server test push.client.test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/notifications/push.client.ts apps/server/src/features/notifications/push.client.test.ts
git commit -m "feat(notifications): expo push client wrapper"
```

---

## Task 8: Tokens repository (with upsert)

**Files:**
- Create: `apps/server/src/features/notifications/tokens.repository.ts`
- Create: `apps/server/src/features/notifications/tokens.repository.integration.test.ts`

- [ ] **Step 1: Failing integration tests**

```typescript
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
    await repo.deleteForUser(USER_A, "ExponentPushToken[b]");  // not owned — no-op
    const bRows = await db.select().from(pushToken).where(eq(pushToken.token, "ExponentPushToken[b]"));
    expect(bRows).toHaveLength(1);

    await repo.deleteForUser(USER_A, "ExponentPushToken[a]");
    const aRows = await db.select().from(pushToken).where(eq(pushToken.token, "ExponentPushToken[a]"));
    expect(aRows).toHaveLength(0);
  });

  it("deleteTokens removes a set of tokens regardless of owner (used by receipt pruning)", async () => {
    await repo.upsert(USER_A, "ExponentPushToken[x]", "ios");
    await repo.upsert(USER_B, "ExponentPushToken[y]", "ios");
    await repo.deleteTokens(["ExponentPushToken[x]", "ExponentPushToken[y]"]);
    const rows = await db.select().from(pushToken);
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
pnpm --filter server test:integration tokens.repository
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/features/notifications/tokens.repository.ts`:

```typescript
import { and, eq, inArray } from "drizzle-orm";
import { pushToken } from "@pruvi/db/schema/push-tokens";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class TokensRepository {
  constructor(private db: DbClient) {}

  /** Upsert by token: insert or reassign user_id + refresh last_used_at. */
  async upsert(userId: string, token: string, platform: "ios" | "android") {
    const [row] = await this.db
      .insert(pushToken)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: pushToken.token,
        set: { userId, platform, lastUsedAt: new Date() },
      })
      .returning();
    return row;
  }

  async listByUser(userId: string) {
    return this.db
      .select()
      .from(pushToken)
      .where(eq(pushToken.userId, userId));
  }

  /** Delete a single token only if it belongs to userId. Silent if not. */
  async deleteForUser(userId: string, token: string) {
    await this.db
      .delete(pushToken)
      .where(and(eq(pushToken.userId, userId), eq(pushToken.token, token)));
  }

  /** Delete a set of tokens regardless of owner (used by receipt pruning). */
  async deleteTokens(tokens: string[]) {
    if (tokens.length === 0) return;
    await this.db.delete(pushToken).where(inArray(pushToken.token, tokens));
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm --filter server test:integration tokens.repository
```
Expected: PASS — all 5 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/notifications/tokens.repository.ts apps/server/src/features/notifications/tokens.repository.integration.test.ts
git commit -m "feat(notifications): tokens repository with upsert"
```

---

## Task 9: Tokens service + route

**Files:**
- Create: `apps/server/src/features/notifications/tokens.service.ts`
- Create: `apps/server/src/features/notifications/tokens.service.test.ts`
- Create: `apps/server/src/features/notifications/tokens.route.ts`

- [ ] **Step 1: Failing unit tests**

```typescript
import { describe, expect, it, vi } from "vitest";
import { TokensService } from "./tokens.service";

function stubRepo(overrides: any = {}) {
  return {
    upsert: vi.fn().mockResolvedValue({ id: 1, token: "t", platform: "ios", userId: "u", lastUsedAt: new Date(), createdAt: new Date() }),
    deleteForUser: vi.fn().mockResolvedValue(undefined),
    listByUser: vi.fn().mockResolvedValue([]),
    deleteTokens: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("TokensService.register", () => {
  it("returns the upserted row data on success", async () => {
    const repo = stubRepo();
    const service = new TokensService(repo as any);
    const result = await service.register("u", "ExponentPushToken[a]", "ios");
    expect(result.isOk()).toBe(true);
    expect(repo.upsert).toHaveBeenCalledWith("u", "ExponentPushToken[a]", "ios");
  });
});

describe("TokensService.unregister", () => {
  it("calls deleteForUser and returns ok regardless", async () => {
    const repo = stubRepo();
    const service = new TokensService(repo as any);
    const result = await service.unregister("u", "ExponentPushToken[a]");
    expect(result.isOk()).toBe(true);
    expect(repo.deleteForUser).toHaveBeenCalledWith("u", "ExponentPushToken[a]");
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
pnpm --filter server test tokens.service.test
```

- [ ] **Step 3: Implement service**

`apps/server/src/features/notifications/tokens.service.ts`:

```typescript
import { ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import type { TokensRepository } from "./tokens.repository";

export class TokensService {
  constructor(private repo: TokensRepository) {}

  async register(
    userId: string,
    token: string,
    platform: "ios" | "android",
  ): Promise<Result<{ id: number; token: string; platform: "ios" | "android" }, AppError>> {
    const row = await this.repo.upsert(userId, token, platform);
    return ok({ id: row.id, token: row.token, platform: row.platform });
  }

  async unregister(userId: string, token: string): Promise<Result<null, AppError>> {
    await this.repo.deleteForUser(userId, token);
    return ok(null);
  }

  /** Used by dispatcher. */
  async listTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.repo.listByUser(userId);
    return rows.map((r) => r.token);
  }
}
```

- [ ] **Step 4: Confirm tests pass**

```bash
pnpm --filter server test tokens.service.test
```

- [ ] **Step 5: Implement route**

`apps/server/src/features/notifications/tokens.route.ts`:

```typescript
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { RegisterPushTokenBodySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { TokensRepository } from "./tokens.repository";
import { TokensService } from "./tokens.service";

const repo = new TokensRepository(db);
const service = new TokensService(repo);

export const tokensRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/users/me/push-tokens",
    {
      preHandler: [fastify.authenticate],
      schema: { body: RegisterPushTokenBodySchema },
    },
    async (request) => {
      const { token, platform } = request.body;
      const result = await service.register(request.userId, token, platform);
      return unwrapResult(result);
    },
  );

  fastify.delete(
    "/users/me/push-tokens/:token",
    {
      preHandler: [fastify.authenticate],
      schema: { params: z.object({ token: z.string() }) },
    },
    async (request, reply) => {
      const { token } = request.params;
      await service.unregister(request.userId, token);
      reply.status(204).send();
    },
  );
};
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/notifications/tokens.service.ts apps/server/src/features/notifications/tokens.service.test.ts apps/server/src/features/notifications/tokens.route.ts
git commit -m "feat(notifications): tokens service + register/delete routes"
```

---

## Task 10: Preferences (repo + service + route)

**Files:**
- Create: `apps/server/src/features/notifications/preferences.repository.ts`
- Create: `apps/server/src/features/notifications/preferences.service.ts`
- Create: `apps/server/src/features/notifications/preferences.service.test.ts`
- Create: `apps/server/src/features/notifications/preferences.route.ts`

- [ ] **Step 1: Failing unit tests**

```typescript
import { describe, expect, it, vi } from "vitest";
import { PreferencesService } from "./preferences.service";

function stubRepo(overrides: any = {}) {
  return {
    get: vi.fn().mockResolvedValue({
      notificationHour: 19,
      streakRemindersEnabled: true,
      achievementNotificationsEnabled: true,
    }),
    update: vi.fn().mockImplementation(async (_userId, patch) => ({
      notificationHour: patch.notificationHour ?? 19,
      streakRemindersEnabled: patch.streakRemindersEnabled ?? true,
      achievementNotificationsEnabled: patch.achievementNotificationsEnabled ?? true,
    })),
    ...overrides,
  };
}

describe("PreferencesService.get", () => {
  it("returns ok with prefs from repo", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.get("u");
    expect(result._unsafeUnwrap()).toMatchObject({
      notificationHour: 19,
      streakRemindersEnabled: true,
      achievementNotificationsEnabled: true,
    });
  });

  it("returns NotFoundError when repo returns null", async () => {
    const repo = stubRepo({ get: vi.fn().mockResolvedValue(null) });
    const service = new PreferencesService(repo as any);
    const result = await service.get("u");
    expect(result.isErr()).toBe(true);
  });
});

describe("PreferencesService.update", () => {
  it("applies partial patch", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.update("u", { notificationHour: 20 });
    expect(result._unsafeUnwrap().notificationHour).toBe(20);
    expect(repo.update).toHaveBeenCalledWith("u", { notificationHour: 20 });
  });

  it("rejects an out-of-range hour", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.update("u", { notificationHour: 25 });
    expect(result.isErr()).toBe(true);
  });

  it("rejects a negative hour", async () => {
    const repo = stubRepo();
    const service = new PreferencesService(repo as any);
    const result = await service.update("u", { notificationHour: -1 });
    expect(result.isErr()).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
pnpm --filter server test preferences.service.test
```

- [ ] **Step 3: Implement repository**

`apps/server/src/features/notifications/preferences.repository.ts`:

```typescript
import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export type PrefsRow = {
  notificationHour: number;
  streakRemindersEnabled: boolean;
  achievementNotificationsEnabled: boolean;
};

export type PrefsPatch = Partial<PrefsRow>;

export class PreferencesRepository {
  constructor(private db: DbClient) {}

  async get(userId: string): Promise<PrefsRow | null> {
    const [row] = await this.db
      .select({
        notificationHour: user.notificationHour,
        streakRemindersEnabled: user.streakRemindersEnabled,
        achievementNotificationsEnabled: user.achievementNotificationsEnabled,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }

  async update(userId: string, patch: PrefsPatch): Promise<PrefsRow | null> {
    const [row] = await this.db
      .update(user)
      .set(patch)
      .where(eq(user.id, userId))
      .returning({
        notificationHour: user.notificationHour,
        streakRemindersEnabled: user.streakRemindersEnabled,
        achievementNotificationsEnabled: user.achievementNotificationsEnabled,
      });
    return row ?? null;
  }
}
```

- [ ] **Step 4: Implement service**

`apps/server/src/features/notifications/preferences.service.ts`:

```typescript
import { err, ok, type Result } from "neverthrow";
import { NotFoundError, ValidationError, type AppError } from "../../utils/errors";
import type {
  PreferencesRepository,
  PrefsPatch,
  PrefsRow,
} from "./preferences.repository";

export class PreferencesService {
  constructor(private repo: PreferencesRepository) {}

  async get(userId: string): Promise<Result<PrefsRow, AppError>> {
    const prefs = await this.repo.get(userId);
    if (!prefs) return err(new NotFoundError("User not found"));
    return ok(prefs);
  }

  async update(userId: string, patch: PrefsPatch): Promise<Result<PrefsRow, AppError>> {
    if (patch.notificationHour !== undefined) {
      if (
        !Number.isInteger(patch.notificationHour) ||
        patch.notificationHour < 0 ||
        patch.notificationHour > 23
      ) {
        return err(new ValidationError("notificationHour must be 0–23"));
      }
    }
    const updated = await this.repo.update(userId, patch);
    if (!updated) return err(new NotFoundError("User not found"));
    return ok(updated);
  }
}
```

- [ ] **Step 5: Run, confirm pass**

```bash
pnpm --filter server test preferences.service.test
```
Expected: PASS.

- [ ] **Step 6: Implement route**

`apps/server/src/features/notifications/preferences.route.ts`:

```typescript
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UpdateNotificationPreferencesBodySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { PreferencesRepository } from "./preferences.repository";
import { PreferencesService } from "./preferences.service";

const repo = new PreferencesRepository(db);
const service = new PreferencesService(repo);

const PREFS_TTL = 60;

export const preferencesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/notification-preferences",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const cacheKey = `prefs:notif:${request.userId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.get(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PREFS_TTL);
      return response;
    },
  );

  fastify.put(
    "/users/me/notification-preferences",
    {
      preHandler: [fastify.authenticate],
      schema: { body: UpdateNotificationPreferencesBodySchema },
    },
    async (request) => {
      const result = await service.update(request.userId, request.body);
      const response = unwrapResult(result);
      await fastify.cache.del(`prefs:notif:${request.userId}`);
      return response;
    },
  );
};
```

- [ ] **Step 7: Module index**

`apps/server/src/features/notifications/index.ts`:

```typescript
export { tokensRoutes } from "./tokens.route";
export { preferencesRoutes } from "./preferences.route";
```

- [ ] **Step 8: Register routes**

In `apps/server/src/index.ts`, add the import and registrations near other features:
```typescript
import { tokensRoutes, preferencesRoutes } from "./features/notifications";
// ...
await app.register(tokensRoutes);
await app.register(preferencesRoutes);
```

- [ ] **Step 9: Boot smoke**

```bash
pnpm dev:server
```
Confirm clean startup, then kill.

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/features/notifications/ apps/server/src/index.ts
git commit -m "feat(notifications): preferences endpoints + module index"
```

---

## Task 11: Dispatcher service

**Files:**
- Create: `apps/server/src/features/notifications/dispatcher.ts`
- Create: `apps/server/src/features/notifications/dispatcher.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
import { describe, expect, it, vi } from "vitest";
import { Dispatcher } from "./dispatcher";

function makeDeps(over: any = {}) {
  return {
    tokensService: { listTokensForUser: vi.fn().mockResolvedValue(["ExponentPushToken[a]"]) },
    prefsRepo: { get: vi.fn().mockResolvedValue({ notificationHour: 19, streakRemindersEnabled: true, achievementNotificationsEnabled: true }) },
    sweepRepo: {
      findEligibleForStreakReminder: vi.fn().mockResolvedValue([
        { userId: "u1", token: "ExponentPushToken[u1]" },
        { userId: "u2", token: "ExponentPushToken[u2]" },
      ]),
    },
    sendQueue: { add: vi.fn().mockResolvedValue(undefined) },
    ...over,
  };
}

describe("Dispatcher.sendAchievementNotification", () => {
  it("bails when achievement_notifications_enabled is false", async () => {
    const deps = makeDeps({
      prefsRepo: {
        get: vi.fn().mockResolvedValue({ notificationHour: 19, streakRemindersEnabled: true, achievementNotificationsEnabled: false }),
      },
    });
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "7-day-streak");
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("bails when user has no tokens", async () => {
    const deps = makeDeps({
      tokensService: { listTokensForUser: vi.fn().mockResolvedValue([]) },
    });
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "7-day-streak");
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });

  it("enqueues a send job for a 7-day streak", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "7-day-streak");
    expect(deps.sendQueue.add).toHaveBeenCalledTimes(1);
    const [_name, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.tokens).toEqual(["ExponentPushToken[a]"]);
    expect(payload.title).toMatch(/7/);
  });

  it("includes the subtopic name in the mastery achievement body", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.sendAchievementNotification("u", "quase-mestre", { subtopicName: "Membrana" });
    const [, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.body).toContain("Membrana");
  });
});

describe("Dispatcher.dispatchStreakReminder", () => {
  it("calls the eligibility query with hour and enqueues a send per chunk", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.dispatchStreakReminder({ brtHour: 19, variant: "primary" });
    expect(deps.sweepRepo.findEligibleForStreakReminder).toHaveBeenCalledWith(19);
    expect(deps.sendQueue.add).toHaveBeenCalledTimes(1);
    const [, payload] = deps.sendQueue.add.mock.calls[0];
    expect(payload.tokens).toEqual(["ExponentPushToken[u1]", "ExponentPushToken[u2]"]);
  });

  it("late variant queries hour minus 2 modulo 24", async () => {
    const deps = makeDeps();
    const d = new Dispatcher(deps as any);
    await d.dispatchStreakReminder({ brtHour: 1, variant: "late" });
    expect(deps.sweepRepo.findEligibleForStreakReminder).toHaveBeenCalledWith(23);
  });

  it("does nothing when no eligible users", async () => {
    const deps = makeDeps({
      sweepRepo: { findEligibleForStreakReminder: vi.fn().mockResolvedValue([]) },
    });
    const d = new Dispatcher(deps as any);
    await d.dispatchStreakReminder({ brtHour: 19, variant: "primary" });
    expect(deps.sendQueue.add).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
pnpm --filter server test dispatcher.test
```

- [ ] **Step 3: Implement**

`apps/server/src/features/notifications/dispatcher.ts`:

```typescript
import type { Queue } from "bullmq";
import {
  streakReminderPrimary,
  streakReminderLate,
  streakMilestone,
  masteryAchievement,
  type PushPayload,
} from "./templates";
import type { TokensService } from "./tokens.service";
import type { PreferencesRepository } from "./preferences.repository";
import type { SweepRepository } from "./sweep.repository";
import { EXPO_BATCH_SIZE } from "./push.client";

export type AchievementKind = "7-day-streak" | "30-day-streak" | "quase-mestre";

export type SendJobData = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type DispatcherDeps = {
  tokensService: TokensService;
  prefsRepo: PreferencesRepository;
  sweepRepo: SweepRepository;
  sendQueue: Queue<SendJobData>;
};

export class Dispatcher {
  constructor(private deps: DispatcherDeps) {}

  async sendAchievementNotification(
    userId: string,
    kind: AchievementKind,
    vars?: { subtopicName?: string },
  ): Promise<void> {
    const prefs = await this.deps.prefsRepo.get(userId);
    if (!prefs?.achievementNotificationsEnabled) return;

    const tokens = await this.deps.tokensService.listTokensForUser(userId);
    if (tokens.length === 0) return;

    let payload: PushPayload;
    if (kind === "7-day-streak") payload = streakMilestone(7);
    else if (kind === "30-day-streak") payload = streakMilestone(30);
    else payload = masteryAchievement(vars?.subtopicName ?? "");

    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const chunk = tokens.slice(i, i + EXPO_BATCH_SIZE);
      await this.deps.sendQueue.add("send", {
        tokens: chunk,
        title: payload.title,
        body: payload.body,
        data: { kind },
      });
    }
  }

  async dispatchStreakReminder(opts: { brtHour: number; variant: "primary" | "late" }): Promise<void> {
    const targetHour = opts.variant === "late" ? (opts.brtHour - 2 + 24) % 24 : opts.brtHour;
    const eligible = await this.deps.sweepRepo.findEligibleForStreakReminder(targetHour);
    if (eligible.length === 0) return;

    const payload = opts.variant === "late" ? streakReminderLate() : streakReminderPrimary();
    const tokens = eligible.map((r) => r.token);

    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const chunk = tokens.slice(i, i + EXPO_BATCH_SIZE);
      await this.deps.sendQueue.add("send", {
        tokens: chunk,
        title: payload.title,
        body: payload.body,
        data: { kind: `streak-${opts.variant}` },
      });
    }
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm --filter server test dispatcher.test
```
Expected: PASS — 7 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/notifications/dispatcher.ts apps/server/src/features/notifications/dispatcher.test.ts
git commit -m "feat(notifications): dispatcher for streak + achievement pushes"
```

---

## Task 12: Sweep repository (eligibility query)

**Files:**
- Create: `apps/server/src/features/notifications/sweep.repository.ts`
- Create: `apps/server/src/features/notifications/notifications.sweep.integration.test.ts`

- [ ] **Step 1: Failing integration tests**

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb, getTestDb, teardownTestDb, cleanupTestDb } from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { pushToken } from "@pruvi/db/schema/push-tokens";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { SweepRepository } from "./sweep.repository";

const db = getTestDb();
const repo = new SweepRepository(db);

beforeAll(async () => { await setupTestDb(); });
afterAll(async () => { await teardownTestDb(); });
beforeEach(async () => { await cleanupTestDb(); });

describe("SweepRepository.findEligibleForStreakReminder", () => {
  it("returns user with hour match + token + reminders enabled + no completed session today", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19, streakRemindersEnabled: true });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([{ userId: "u1", token: "ExponentPushToken[u1]" }]);
  });

  it("skips users with streakRemindersEnabled = false", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19, streakRemindersEnabled: false });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });

  it("skips users whose hour doesn't match", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 20 });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });

  it("skips users who have a completed session today", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    await db.insert(dailySession).values({ userId: "u1", status: "completed" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });

  it("includes users with an active (incomplete) session today", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    await db.insert(pushToken).values({ userId: "u1", token: "ExponentPushToken[u1]", platform: "ios" });
    await db.insert(dailySession).values({ userId: "u1", status: "active" });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows.map((r) => r.userId)).toEqual(["u1"]);
  });

  it("returns one row per (user, token) pair when user has multiple devices", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    await db.insert(pushToken).values([
      { userId: "u1", token: "ExponentPushToken[a]", platform: "ios" },
      { userId: "u1", token: "ExponentPushToken[b]", platform: "android" },
    ]);
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows.map((r) => r.token).sort()).toEqual(["ExponentPushToken[a]", "ExponentPushToken[b]"]);
  });

  it("skips users with no push tokens", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@x.com", notificationHour: 19 });
    const rows = await repo.findEligibleForStreakReminder(19);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
pnpm --filter server test:integration notifications.sweep
```

- [ ] **Step 3: Implement**

`apps/server/src/features/notifications/sweep.repository.ts`:

```typescript
import { sql } from "drizzle-orm";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class SweepRepository {
  constructor(private db: DbClient) {}

  async findEligibleForStreakReminder(brtHour: number): Promise<Array<{ userId: string; token: string }>> {
    const rows = await this.db.execute(sql<{ user_id: string; token: string }>`
      SELECT u.id AS user_id, pt.token
      FROM "user" u
      JOIN "push_token" pt ON pt.user_id = u.id
      WHERE u.streak_reminders_enabled = TRUE
        AND u.notification_hour = ${brtHour}
        AND NOT EXISTS (
          SELECT 1 FROM "daily_session" ds
          WHERE ds.user_id = u.id
            AND ds.status = 'completed'
            AND ds.created_at::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        )
    `);
    return (rows as any).rows
      ? (rows as any).rows.map((r: any) => ({ userId: r.user_id, token: r.token }))
      : (rows as any).map((r: any) => ({ userId: r.user_id, token: r.token }));
  }
}
```

Note: `db.execute(sql\`...\`)` shape varies between node-postgres and PGlite. The conditional handling at the end accommodates both. If your environment produces a single consistent shape, simplify accordingly during implementation.

- [ ] **Step 4: Run, confirm pass**

```bash
pnpm --filter server test:integration notifications.sweep
```
Expected: PASS — 7 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/features/notifications/sweep.repository.ts apps/server/src/features/notifications/notifications.sweep.integration.test.ts
git commit -m "feat(notifications): sweep eligibility query"
```

---

## Task 13: Queue plugin — register notifications queues + cron

**Files:**
- Modify: `apps/server/src/plugins/queue.ts`

- [ ] **Step 1: Extend the plugin**

Replace the contents of `apps/server/src/plugins/queue.ts`:

```typescript
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Queue } from "bullmq";
import { env } from "@pruvi/env/server";
import { parseRedisUrl } from "../utils/redis";
import type { SendJobData } from "../features/notifications/dispatcher";

declare module "fastify" {
  interface FastifyInstance {
    queues: {
      sessionPrefetch: Queue | null;
      notificationsCron: Queue | null;
      notificationsSend: Queue<SendJobData> | null;
    };
  }
}

export type SessionPrefetchJobData = {
  userId: string;
  mode: "all" | "theoretical";
};

export type NotificationsCronJobData = { kind: "sweep" };

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  if (!env.REDIS_URL) {
    fastify.log.info("No REDIS_URL — BullMQ queues disabled");
    fastify.decorate("queues", { sessionPrefetch: null, notificationsCron: null, notificationsSend: null });
    return;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  const sessionPrefetchQueue = new Queue<SessionPrefetchJobData>("session-prefetch", { connection });
  const notificationsCronQueue = new Queue<NotificationsCronJobData>("notifications-cron", { connection });
  const notificationsSendQueue = new Queue<SendJobData>("notifications-send", { connection });

  // Register hourly cron (idempotent — BullMQ dedupes repeatable jobs by name + pattern)
  await notificationsCronQueue.add(
    "sweep",
    { kind: "sweep" },
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: true, removeOnFail: true },
  );

  fastify.decorate("queues", {
    sessionPrefetch: sessionPrefetchQueue,
    notificationsCron: notificationsCronQueue,
    notificationsSend: notificationsSendQueue,
  });

  fastify.addHook("onClose", async () => {
    await Promise.all([
      sessionPrefetchQueue.close(),
      notificationsCronQueue.close(),
      notificationsSendQueue.close(),
    ]);
  });
};

export const queuePlugin = fp(plugin, {
  name: "queue",
  dependencies: ["redis"],
});
```

- [ ] **Step 2: Boot smoke**

```bash
pnpm dev:server
```
Confirm clean startup (Redis must be running). Kill.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/plugins/queue.ts
git commit -m "feat(queue): register notifications-cron + notifications-send queues"
```

---

## Task 14: Notifications worker

**Files:**
- Create: `apps/server/src/workers/notifications.worker.ts`
- Modify: `apps/server/src/worker.ts`

- [ ] **Step 1: Implement worker**

`apps/server/src/workers/notifications.worker.ts`:

```typescript
import { Worker, Queue, type Job } from "bullmq";
import Expo from "expo-server-sdk";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { parseRedisUrl } from "../utils/redis";
import { TokensRepository } from "../features/notifications/tokens.repository";
import { TokensService } from "../features/notifications/tokens.service";
import { PreferencesRepository } from "../features/notifications/preferences.repository";
import { SweepRepository } from "../features/notifications/sweep.repository";
import { Dispatcher, type SendJobData } from "../features/notifications/dispatcher";
import { PushClient } from "../features/notifications/push.client";

export function startNotificationsWorker() {
  if (!env.REDIS_URL) {
    console.log("No REDIS_URL — notifications worker disabled");
    return null;
  }

  const connection = parseRedisUrl(env.REDIS_URL);

  const tokensRepo = new TokensRepository(db);
  const prefsRepo = new PreferencesRepository(db);
  const sweepRepo = new SweepRepository(db);
  const tokensService = new TokensService(tokensRepo);
  const sendQueue = new Queue<SendJobData>("notifications-send", { connection });
  const dispatcher = new Dispatcher({ tokensService, prefsRepo, sweepRepo, sendQueue });

  const expo = new Expo(env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : {});
  const pushClient = new PushClient(expo);

  // Cron worker
  const cronWorker = new Worker(
    "notifications-cron",
    async (_job: Job<{ kind: "sweep" }>) => {
      const utcHour = new Date().getUTCHours();
      const brtHour = (utcHour + 24 - 3) % 24;
      await dispatcher.dispatchStreakReminder({ brtHour, variant: "primary" });
      await dispatcher.dispatchStreakReminder({ brtHour, variant: "late" });
      return { brtHour };
    },
    { connection, concurrency: 1 },
  );

  // Send worker
  const sendWorker = new Worker<SendJobData>(
    "notifications-send",
    async (job: Job<SendJobData>) => {
      const { tokens, title, body, data } = job.data;
      const tickets = await pushClient.sendBatch(tokens, { title, body }, data);
      const pruned = pushClient.pruneTokensFromTickets(tokens, tickets);
      if (pruned.length > 0) {
        await tokensRepo.deleteTokens(pruned);
      }
      return { sent: tokens.length, pruned: pruned.length };
    },
    { connection, concurrency: 5 },
  );

  cronWorker.on("failed", (job, err) => console.error("cron job failed:", job?.id, err));
  sendWorker.on("failed", (job, err) => console.error("send job failed:", job?.id, err));

  const cleanup = async () => {
    await Promise.all([cronWorker.close(), sendWorker.close(), sendQueue.close()]);
  };

  return { cleanup };
}
```

- [ ] **Step 2: Start it from the worker entrypoint**

Replace `apps/server/src/worker.ts`:

```typescript
import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";
import { startNotificationsWorker } from "./workers/notifications.worker";

const prefetch = startSessionPrefetchWorker();
const notifications = startNotificationsWorker();

if (!prefetch && !notifications) {
  console.error("All workers failed to start — REDIS_URL required");
  process.exit(1);
}

console.log("Workers started: ", {
  prefetch: !!prefetch,
  notifications: !!notifications,
});

const shutdown = async () => {
  console.log("Shutting down workers...");
  if (prefetch) await prefetch.cleanup();
  if (notifications) await notifications.cleanup();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

- [ ] **Step 3: Boot smoke**

```bash
pnpm dev:worker
```
Confirm both workers register. Kill.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/workers/notifications.worker.ts apps/server/src/worker.ts
git commit -m "feat(worker): notifications cron + send workers"
```

---

## Task 15: Wire achievement hooks into sessions.completeSession

**Files:**
- Modify: `apps/server/src/features/sessions/sessions.service.ts`
- Modify: `apps/server/src/features/sessions/sessions.route.ts`

- [ ] **Step 1: Inject dispatcher into SessionsService**

Find the existing `SessionsService` constructor (3 args: repo, questionsService, topicsService). Add a 4th optional arg for the dispatcher. Updated constructor:

```typescript
import type { Dispatcher } from "../notifications/dispatcher";
import type { StreaksService } from "../streaks/streaks.service";

export class SessionsService {
  constructor(
    private repo: SessionsRepository,
    private questionsService: QuestionsService,
    private topicsService: TopicsService,
    private streaksService: StreaksService | null = null,
    private dispatcher: Dispatcher | null = null,
  ) {}
```

(Defaults to `null` so existing test instantiations don't break; production wiring passes both.)

- [ ] **Step 2: Fire achievements in `completeSession`**

In `completeSession`, after `const completed = await this.repo.completeSession(...)` and before the final `return ok(...)`, add:

```typescript
// Fire-and-forget achievement notifications
if (this.dispatcher) {
  // Streak milestone push (7d or 30d)
  if (this.streaksService) {
    this.streaksService
      .getStreaks(userId)
      .then((r) => {
        if (r.isOk() && (r.value.currentStreak === 7 || r.value.currentStreak === 30)) {
          this.dispatcher!
            .sendAchievementNotification(userId, `${r.value.currentStreak}-day-streak` as "7-day-streak" | "30-day-streak")
            .catch((e) => console.error("streak achievement push failed", e));
        }
      })
      .catch((e) => console.error("streak read failed in achievement hook", e));
  }

  // Mastery achievement push (per quase_mestre transition)
  for (const t of transitions) {
    if (t.to === "quase_mestre") {
      this.dispatcher
        .sendAchievementNotification(userId, "quase-mestre", { subtopicName: t.name })
        .catch((e) => console.error("mastery achievement push failed", e));
    }
  }
}
```

- [ ] **Step 3: Wire dispatcher in the route**

In `sessions.route.ts`, after the existing service instantiation, add:

```typescript
import { TokensRepository } from "../notifications/tokens.repository";
import { TokensService } from "../notifications/tokens.service";
import { PreferencesRepository } from "../notifications/preferences.repository";
import { SweepRepository } from "../notifications/sweep.repository";
import { Dispatcher } from "../notifications/dispatcher";
import { StreaksRepository } from "../streaks/streaks.repository";
import { StreaksService } from "../streaks/streaks.service";

const tokensRepo = new TokensRepository(db);
const prefsRepo = new PreferencesRepository(db);
const sweepRepo = new SweepRepository(db);
const tokensService = new TokensService(tokensRepo);
const streaksRepo = new StreaksRepository(db);
const streaksService = new StreaksService(streaksRepo);
```

For the dispatcher we need the `notificationsSend` queue from the fastify plugin. The cleanest path: inject lazily inside the route plugin function via `fastify.queues.notificationsSend`. Wrap the service instantiation inside the plugin async fn instead of at module scope:

```typescript
export const sessionsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const dispatcher = fastify.queues.notificationsSend
    ? new Dispatcher({
        tokensService,
        prefsRepo,
        sweepRepo,
        sendQueue: fastify.queues.notificationsSend,
      })
    : null;
  const service = new SessionsService(sessionsRepo, questionsService, topicsService, streaksService, dispatcher);

  // ... existing route handlers (refer to `service`)
};
```

(If the existing route file has `service` at module scope, refactor it to live inside the plugin function. The closure-captured `service` still works for handlers.)

- [ ] **Step 4: Update existing tests for the new constructor**

Where `new SessionsService(repo, questionsService, topicsService)` is called in tests, leave as-is — the new params default to null. Confirm the test suite still passes:

```bash
pnpm --filter server test sessions.service
```

- [ ] **Step 5: Run full suite**

```bash
pnpm --filter server test
pnpm --filter server test:integration
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/features/sessions/
git commit -m "feat(sessions): fire achievement notifications on complete"
```

---

## Task 16: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Migration smoke**

```bash
pnpm verify:migration
```
Expected: PASS — `push_token` and the 3 user columns queryable.

- [ ] **Step 2: Full test suite**

```bash
pnpm --filter server test
pnpm --filter server test:integration
pnpm --filter @pruvi/shared test
```
Expected: PASS (modulo pre-existing `sm2.test.ts` failures in `@pruvi/shared` unrelated to this phase).

- [ ] **Step 3: Typecheck**

```bash
pnpm run check-types
```
Expected: zero NEW non-test errors. Pre-existing test typecheck noise carries over.

- [ ] **Step 4: Server boot smoke**

```bash
pnpm dev:server &
SERVER_PID=$!
sleep 3
kill $SERVER_PID 2>/dev/null
```

- [ ] **Step 5: Worker boot smoke**

```bash
pnpm dev:worker &
WORKER_PID=$!
sleep 3
kill $WORKER_PID 2>/dev/null
```
Confirm logs show both `session-prefetch` and `notifications` workers started, plus the `notifications-cron` queue registered.

- [ ] **Step 6: Cron registration check**

```bash
docker exec -i $(docker ps --filter "name=redis" -q | head -1) redis-cli ZRANGE "bull:notifications-cron:repeat" 0 -1
```
Expected: one entry for the `sweep` repeatable job.

- [ ] **Step 7: Final commit if needed**

```bash
git status
```
If anything is dirty:

```bash
git add -A
git commit -m "chore: end-to-end verification fixes"
```

---

## Self-review notes (resolved while writing)

- **Spec coverage:** every section of the spec maps to a task — data model (Tasks 2-4), API surface (Tasks 9-10), scheduling architecture (Tasks 11-14), event hooks (Task 15), templates (Task 6), testing strategy (covered within each task).
- **Achievement hook placement:** all achievement firings happen in `sessions.service.completeSession`. Streak milestones use `streaksService.getStreaks` to read the new currentStreak (no event emitter pattern needed — leverages existing read-side API).
- **Sweep query** uses `NOW() AT TIME ZONE 'America/Sao_Paulo'` to align with the streak service's existing day-boundary convention.
- **Fire-and-forget:** all achievement dispatch is `.catch()`-wrapped so push failures never poison the HTTP response.
- **EXPO_BATCH_SIZE = 100** is a constant in `push.client.ts` and consumed by `dispatcher.ts` — single source of truth.
- **Defaults on new user columns** mean migration 0004 needs no backfill — Postgres applies the defaults to existing rows automatically.

---

*End of plan.*
