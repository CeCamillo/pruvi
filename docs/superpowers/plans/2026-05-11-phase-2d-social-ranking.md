# Phase 2D — Social Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the social backend: friendships, invitations with +100 XP reward, and a weekly XP ranking endpoint scoped to a user's friends.

**Architecture:** Three feature modules (`invitations`, `friendships`, `ranking`) under `apps/server/src/features/social/`. Shared schemas + pure helpers (`startOfWeekBrt`, `generateInviteCode`) live in `@pruvi/shared` / `@pruvi/db`. Single migration `0006` adds 3 tables + 2 user columns + 1 review_log column. Reviews flow gains a one-line `xp_earned` write so weekly XP is sumable.

**Tech Stack:** Drizzle ORM + drizzle-kit, PostgreSQL 16, Bun, Vitest, neverthrow Result, Fastify + fastify-type-provider-zod.

**Source spec:** `docs/superpowers/specs/2026-05-11-phase-2d-social-ranking-design.md`

---

## File Structure (created/modified)

**Create:**
- `packages/shared/src/social.ts` — Zod schemas (Username, InviteCode, request/response bodies)
- `packages/shared/src/social.test.ts` — schema regex tests
- `packages/shared/src/weekly.ts` — `startOfWeekBrt(now)` pure helper
- `packages/shared/src/weekly.test.ts`
- `packages/db/src/schema/friendship.ts`
- `packages/db/src/schema/invitation-acceptance.ts`
- `packages/db/src/migrations/0006_<generated>.sql`
- `apps/server/src/features/social/invite-codes/generator.ts` + `.test.ts`
- `apps/server/src/features/social/invitations/{invitations.repository,invitations.service,invitations.route}.ts` + tests
- `apps/server/src/features/social/friendships/{friendships.repository,friendships.service,friendships.route}.ts` + tests
- `apps/server/src/features/social/ranking/{ranking.repository,ranking.service,ranking.route}.ts` + tests
- `apps/server/src/features/social/index.ts` — aggregates routes

**Modify:**
- `packages/db/src/schema/auth.ts` — add `username`, `inviteCode` columns
- `packages/db/src/schema/review-log.ts` — add `xpEarned`
- `packages/db/src/test-client.ts` — mirror DDL
- `packages/shared/src/index.ts` — re-export new modules
- `apps/server/src/features/reviews/reviews.service.ts` + `reviews.repository.ts` — pass `xpEarned` into insertReview
- `apps/server/src/features/users/users.service.ts` (or wherever profile lives) — add `setUsername`
- `apps/server/src/index.ts` (or `app.ts`) — register social routes

---

## Tasks

### Task 1: Shared schemas + pure helpers

**Files:**
- Create: `packages/shared/src/social.ts`, `packages/shared/src/social.test.ts`
- Create: `packages/shared/src/weekly.ts`, `packages/shared/src/weekly.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/weekly.ts`**

```typescript
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfWeekBrt(now: Date): Date {
  const brtMs = now.getTime() - BRT_OFFSET_MS;
  const brt = new Date(brtMs);
  const dow = brt.getUTCDay(); // 0=Sun ... 6=Sat
  const daysBack = (dow + 6) % 7; // Monday-anchored
  brt.setUTCDate(brt.getUTCDate() - daysBack);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + BRT_OFFSET_MS);
}
```

- [ ] **Step 2: Write `packages/shared/src/weekly.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { startOfWeekBrt } from "./weekly";

describe("startOfWeekBrt", () => {
  it("noon BRT Wednesday → Monday 00:00 BRT", () => {
    // 2026-05-13 15:00:00Z = 2026-05-13 12:00:00 BRT (Wed)
    const input = new Date("2026-05-13T15:00:00Z");
    const r = startOfWeekBrt(input);
    // Monday 2026-05-11 00:00:00 BRT = 2026-05-11 03:00:00Z
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Monday 00:30 BRT → Monday 00:00 BRT (same day)", () => {
    const input = new Date("2026-05-11T03:30:00Z"); // 00:30 BRT
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Monday 23:00 UTC (still Mon 20:00 BRT) → Monday 00:00 BRT", () => {
    const input = new Date("2026-05-11T23:00:00Z");
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Sunday 23:00 BRT → previous Monday", () => {
    // 2026-05-17 23:00 BRT = 2026-05-18 02:00 UTC
    const input = new Date("2026-05-18T02:00:00Z");
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-11T03:00:00.000Z");
  });

  it("Monday 02:00 UTC (Sunday 23:00 BRT) → previous Monday", () => {
    const input = new Date("2026-05-11T02:00:00Z"); // 23:00 BRT Sun
    const r = startOfWeekBrt(input);
    expect(r.toISOString()).toBe("2026-05-04T03:00:00.000Z");
  });
});
```

- [ ] **Step 3: Write `packages/shared/src/social.ts`**

```typescript
import { z } from "zod";

export const UsernameSchema = z.string().regex(/^[a-z0-9_]{3,20}$/, {
  message: "username must be 3-20 chars: lowercase, digits, underscore",
});
export const InviteCodeSchema = z.string().regex(/^[a-z0-9]{8}$/);

export const AcceptInvitationBodySchema = z.object({ code: InviteCodeSchema });
export const RequestFriendBodySchema = z.object({ username: UsernameSchema });
export const RespondRequestBodySchema = z.object({
  action: z.enum(["accept", "decline"]),
});
export const UpdateProfileBodySchema = z.object({ username: UsernameSchema });

export const FriendUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable(),
});

export const InviteLinkResponseSchema = z.object({
  code: InviteCodeSchema,
  url: z.string().url(),
});

export const FriendListResponseSchema = z.object({
  friends: z.array(FriendUserSchema),
});

export const FriendRequestSchema = z.object({
  id: z.number().int(),
  from: FriendUserSchema,
  createdAt: z.string().datetime(),
});
export const RequestListResponseSchema = z.object({
  incoming: z.array(FriendRequestSchema),
});

export const RankingEntrySchema = z.object({
  userId: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().nullable(),
  weeklyXp: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
  isMe: z.boolean(),
});
export const RankingResponseSchema = z.object({
  weekStart: z.string().datetime(),
  entries: z.array(RankingEntrySchema).max(10),
});

export type RankingEntry = z.infer<typeof RankingEntrySchema>;
export type FriendUser = z.infer<typeof FriendUserSchema>;
```

- [ ] **Step 4: Write `packages/shared/src/social.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { UsernameSchema, InviteCodeSchema } from "./social";

describe("UsernameSchema", () => {
  it.each([
    ["ana", true],
    ["ana_b", true],
    ["ana123", true],
    ["AnaBeta", false],     // uppercase
    ["ab", false],          // too short
    ["a".repeat(21), false],// too long
    ["ana b", false],       // space
    ["ana-b", false],       // dash
  ])("%s → %s", (input, valid) => {
    expect(UsernameSchema.safeParse(input).success).toBe(valid);
  });
});

describe("InviteCodeSchema", () => {
  it.each([
    ["abc12def", true],
    ["a1b2c3d4", true],
    ["ABC12DEF", false], // uppercase
    ["abc12de",  false], // 7 chars
    ["abc12defg",false], // 9 chars
    ["ab c12de", false], // space
  ])("%s → %s", (input, valid) => {
    expect(InviteCodeSchema.safeParse(input).success).toBe(valid);
  });
});
```

- [ ] **Step 5: Re-export from index**

In `packages/shared/src/index.ts`, append:

```typescript
export * from "./social";
export * from "./weekly";
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @pruvi/shared test`
Expected: PASS — all weekly + social + previously-passing tests.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/social.ts packages/shared/src/social.test.ts \
        packages/shared/src/weekly.ts packages/shared/src/weekly.test.ts \
        packages/shared/src/index.ts
git commit -m "feat(shared): social schemas + startOfWeekBrt helper"
```

---

### Task 2: DB schema + migration

**Files:**
- Modify: `packages/db/src/schema/auth.ts` (add `username`, `inviteCode`)
- Modify: `packages/db/src/schema/review-log.ts` (add `xpEarned`)
- Create: `packages/db/src/schema/friendship.ts`
- Create: `packages/db/src/schema/invitation-acceptance.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/migrations/0006_<generated>.sql`
- Modify: `packages/db/src/test-client.ts`

- [ ] **Step 1: Add columns to `auth.ts`**

```typescript
// inside the user pgTable, after onboardingCompleted:
username: text("username"),
inviteCode: text("invite_code").notNull(),
```

(Drizzle will see this as required, but the migration backfills before SET NOT NULL — we handle that in the SQL step, not the schema. For now declare `.notNull()` to match final state.)

- [ ] **Step 2: Add `xpEarned` to `review-log.ts`**

```typescript
// inside reviewLog pgTable, after repetitions:
xpEarned: integer("xp_earned").notNull().default(0),
```

- [ ] **Step 3: Create `packages/db/src/schema/friendship.ts`**

```typescript
import { relations } from "drizzle-orm";
import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

export const friendship = pgTable(
  "friendship",
  {
    id: serial("id").primaryKey(),
    requesterId: text("requester_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [
    index("friendship_requester_idx").on(table.requesterId),
    index("friendship_recipient_idx").on(table.recipientId),
    // Pair-uniqueness via LEAST/GREATEST functional index added in raw migration SQL —
    // Drizzle can't express functional UNIQUE indexes natively. The PGlite mirror gets the
    // same index via raw SQL in test-client.ts.
  ],
);

export const friendshipRelations = relations(friendship, ({ one }) => ({
  requester: one(user, { fields: [friendship.requesterId], references: [user.id], relationName: "requester" }),
  recipient: one(user, { fields: [friendship.recipientId], references: [user.id], relationName: "recipient" }),
}));
```

- [ ] **Step 4: Create `packages/db/src/schema/invitation-acceptance.ts`**

```typescript
import { relations } from "drizzle-orm";
import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const invitationAcceptance = pgTable(
  "invitation_acceptance",
  {
    id: serial("id").primaryKey(),
    inviterId: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    inviteeId: text("invitee_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  },
  (table) => [index("invitation_acceptance_inviter_idx").on(table.inviterId)],
);

export const invitationAcceptanceRelations = relations(invitationAcceptance, ({ one }) => ({
  inviter: one(user, { fields: [invitationAcceptance.inviterId], references: [user.id], relationName: "inviter" }),
  invitee: one(user, { fields: [invitationAcceptance.inviteeId], references: [user.id], relationName: "invitee" }),
}));
```

- [ ] **Step 5: Update `packages/db/src/schema/index.ts`**

Append:
```typescript
export * from "./friendship";
export * from "./invitation-acceptance";
```

- [ ] **Step 6: Generate migration**

Run: `pnpm --filter @pruvi/db db:generate`
Expected: creates `0006_<name>.sql`. The generated SQL will likely fail because `invite_code` is NOT NULL with no default on a table that has existing rows. You'll edit it next.

- [ ] **Step 7: Edit the generated migration**

Open the new `0006_<name>.sql`. Apply this final structure (replace whatever drizzle-kit generated; preserve drizzle's `--> statement-breakpoint` markers):

```sql
-- 1. User extensions (idempotent)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "invite_code" text;
--> statement-breakpoint

-- 2. Backfill invite_code for existing users
UPDATE "user"
SET "invite_code" = SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)
WHERE "invite_code" IS NULL;
--> statement-breakpoint

-- 3. NOT NULL + UNIQUE on the populated columns
ALTER TABLE "user" ALTER COLUMN "invite_code" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invite_code_unique') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_invite_code_unique" UNIQUE ("invite_code");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_username_unique') THEN
    ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE ("username");
  END IF;
END $$;
--> statement-breakpoint

-- 4. Case-insensitive username search
CREATE INDEX IF NOT EXISTS "user_username_lower_idx"
  ON "user" (LOWER("username")) WHERE "username" IS NOT NULL;
--> statement-breakpoint

-- 5. review_log.xp_earned
ALTER TABLE "review_log" ADD COLUMN IF NOT EXISTS "xp_earned" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_log_xp_earned_chk') THEN
    ALTER TABLE "review_log" ADD CONSTRAINT "review_log_xp_earned_chk" CHECK ("xp_earned" >= 0);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_log_user_reviewed_idx" ON "review_log" ("user_id", "reviewed_at");
--> statement-breakpoint

-- 6. friendship
CREATE TABLE IF NOT EXISTS "friendship" (
  "id" serial PRIMARY KEY,
  "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "recipient_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "accepted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendship_status_chk') THEN
    ALTER TABLE "friendship" ADD CONSTRAINT "friendship_status_chk" CHECK ("status" IN ('pending','accepted','declined'));
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendship_no_self_chk') THEN
    ALTER TABLE "friendship" ADD CONSTRAINT "friendship_no_self_chk" CHECK ("requester_id" <> "recipient_id");
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friendship_pair_idx" ON "friendship"
  (LEAST("requester_id","recipient_id"), GREATEST("requester_id","recipient_id"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendship_requester_idx" ON "friendship" ("requester_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friendship_recipient_idx" ON "friendship" ("recipient_id");
--> statement-breakpoint

-- 7. invitation_acceptance
CREATE TABLE IF NOT EXISTS "invitation_acceptance" (
  "id" serial PRIMARY KEY,
  "inviter_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "invitee_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "accepted_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_acceptance_inviter_idx" ON "invitation_acceptance" ("inviter_id");
```

- [ ] **Step 8: Mirror in PGlite test-client**

In `packages/db/src/test-client.ts`, add:
- `username text UNIQUE` and `invite_code text NOT NULL UNIQUE` columns to the user table (the latter with a default so test inserts that omit it work — or update integration test helpers to provide it). Simplest: add a generation default `DEFAULT substr(md5(random()::text), 1, 8)`.
- `xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0)` to review_log
- The `friendship` and `invitation_acceptance` CREATE TABLEs with CHECK constraints
- The `friendship_pair_idx` UNIQUE functional index

Match the existing inline-CHECK style in the file (refer to user CHECK constraints added in Phase 2C).

- [ ] **Step 9: Run verify:migration**

Run: `pnpm verify:migration`
Expected: PASS.

- [ ] **Step 10: Run existing tests to confirm nothing broke**

Run: `pnpm --filter server test && pnpm --filter server test:integration`
Expected: PASS — the `xp_earned` default of 0 covers existing INSERTs to review_log, and `invite_code` defaults via the test-client's DDL.

If integration tests fail because the test helper INSERTs into `user` without `invite_code`: add the generation default to the PGlite DDL (Postgres test DB gets `invite_code` from the migration backfill; PGlite needs a default since it skips the backfill statement). Acceptable approach.

- [ ] **Step 11: Commit**

```bash
git add packages/db packages/shared
git commit -m "feat(db): username + invite_code + friendship + invitation tables (migration 0006)"
```

---

### Task 3: Invite-code generator

**Files:**
- Create: `apps/server/src/features/social/invite-codes/generator.ts`
- Create: `apps/server/src/features/social/invite-codes/generator.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest";
import { generateInviteCode, INVITE_CODE_ALPHABET } from "./generator";

describe("generateInviteCode", () => {
  it("returns 8 chars", () => {
    expect(generateInviteCode()).toHaveLength(8);
  });

  it("only contains alphabet chars", () => {
    for (let i = 0; i < 100; i++) {
      const c = generateInviteCode();
      for (const ch of c) {
        expect(INVITE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("low collision rate over 10k samples", () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateInviteCode());
    expect(set.size).toBeGreaterThan(9990); // < 0.1% collisions
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { randomInt } from "node:crypto";

export const INVITE_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += INVITE_CODE_ALPHABET[randomInt(0, INVITE_CODE_ALPHABET.length)];
  }
  return out;
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter server test invite-codes/generator.test.ts
git add apps/server/src/features/social/invite-codes
git commit -m "feat(social): invite code generator (8-char ambiguity-free)"
```

---

### Task 4: Invitations module (repository + service + route)

**Files:**
- Create: `apps/server/src/features/social/invitations/invitations.repository.ts`
- Create: `apps/server/src/features/social/invitations/invitations.service.ts`
- Create: `apps/server/src/features/social/invitations/invitations.route.ts`
- Create: `apps/server/src/features/social/invitations/invitations.service.test.ts`
- Create: `apps/server/src/features/social/invitations/invitations.repository.integration.test.ts`

- [ ] **Step 1: Repository**

```typescript
import { eq, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { invitationAcceptance } from "@pruvi/db/schema/invitation-acceptance";
import { friendship } from "@pruvi/db/schema/friendship";
import { generateInviteCode } from "../invite-codes/generator";

type Db = typeof DbClient;

export class InvitationsRepository {
  constructor(private db: Db) {}

  async ensureInviteCode(userId: string): Promise<string> {
    const rows = await this.db.select({ code: user.inviteCode }).from(user).where(eq(user.id, userId)).limit(1);
    if (rows[0]?.code) return rows[0].code;
    // Defensive: backfilled at migration; if absent (race or test fixture), generate.
    for (let i = 0; i < 5; i++) {
      const code = generateInviteCode();
      try {
        await this.db.update(user).set({ inviteCode: code }).where(eq(user.id, userId));
        return code;
      } catch {}
    }
    throw new Error("Could not assign invite code");
  }

  async findInviterByCode(code: string): Promise<{ id: string; name: string; username: string | null } | null> {
    const rows = await this.db
      .select({ id: user.id, name: user.name, username: user.username })
      .from(user)
      .where(eq(user.inviteCode, code))
      .limit(1);
    return rows[0] ?? null;
  }

  async hasAccepted(inviteeId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: invitationAcceptance.id })
      .from(invitationAcceptance)
      .where(eq(invitationAcceptance.inviteeId, inviteeId))
      .limit(1);
    return rows.length > 0;
  }

  /** Atomic: record acceptance + +100 XP to inviter + upsert accepted friendship. */
  async acceptInvitation(inviterId: string, inviteeId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(invitationAcceptance).values({ inviterId, inviteeId });
      await tx.update(user).set({ totalXp: sql`${user.totalXp} + 100` }).where(eq(user.id, inviterId));
      // Friendship: pair-ordered to fit UNIQUE LEAST/GREATEST index.
      await tx.insert(friendship).values({
        requesterId: inviterId,
        recipientId: inviteeId,
        status: "accepted",
        acceptedAt: new Date(),
      });
    });
  }
}
```

- [ ] **Step 2: Service**

```typescript
import { ok, err, type Result } from "neverthrow";
import { AppError, NotFoundError, ValidationError } from "../../../utils/errors";
import type { InvitationsRepository } from "./invitations.repository";

const INVITE_URL_BASE = process.env.INVITE_URL_BASE ?? "https://pruvi.app/i";

export class InvitationsService {
  constructor(private repo: InvitationsRepository) {}

  async getInvite(userId: string): Promise<Result<{ code: string; url: string }, AppError>> {
    const code = await this.repo.ensureInviteCode(userId);
    return ok({ code, url: `${INVITE_URL_BASE}/${code}` });
  }

  async acceptInvitation(
    code: string,
    userId: string,
  ): Promise<Result<{ inviter: { name: string; username: string | null }; xpAwarded: number; friendshipCreated: true }, AppError>> {
    const inviter = await this.repo.findInviterByCode(code);
    if (!inviter) return err(new NotFoundError("Invite code not found"));
    if (inviter.id === userId) return err(new ValidationError("Cannot accept your own invite"));
    if (await this.repo.hasAccepted(userId)) return err(new ValidationError("You have already accepted an invitation"));
    try {
      await this.repo.acceptInvitation(inviter.id, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("friendship_pair_idx") || msg.includes("invitation_acceptance")) {
        return err(new ValidationError("Invitation already processed"));
      }
      throw e;
    }
    return ok({
      inviter: { name: inviter.name, username: inviter.username },
      xpAwarded: 100,
      friendshipCreated: true as const,
    });
  }
}
```

- [ ] **Step 3: Route**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AcceptInvitationBodySchema, InviteLinkResponseSchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { authGuard } from "../../../plugins/auth-guard";
import { handleResult } from "../../../utils/handle-result";
import { InvitationsRepository } from "./invitations.repository";
import { InvitationsService } from "./invitations.service";

const service = new InvitationsService(new InvitationsRepository(db));

export async function invitationsRoutes(app: FastifyInstance) {
  app.get("/users/me/invite", { preHandler: authGuard, schema: { response: { 200: z.object({ success: z.literal(true), data: InviteLinkResponseSchema }) } } }, async (req, reply) => {
    return handleResult(reply, await service.getInvite(req.userId!));
  });

  app.post("/invitations/accept", { preHandler: authGuard, schema: { body: AcceptInvitationBodySchema } }, async (req, reply) => {
    const body = req.body as z.infer<typeof AcceptInvitationBodySchema>;
    return handleResult(reply, await service.acceptInvitation(body.code, req.userId!));
  });
}
```

*Adjust imports for the actual auth guard and result-handler names in this codebase — search for `authGuard`/`handleResult` in `apps/server/src` to find the canonical pattern. Use whatever existing routes use (e.g., `tokens.route.ts` or `subjects.route.ts`).*

- [ ] **Step 4: Unit test (service)**

Cases: self-invite rejected, already-accepted rejected, happy path returns +100 XP shape, code-not-found returns NotFoundError.

- [ ] **Step 5: Integration test (repository)**

Cases: ensureInviteCode returns existing code idempotently; findInviterByCode resolves; hasAccepted true after acceptance; acceptInvitation in tx commits all 3 mutations and is atomic on failure (e.g., simulate FK error → no partial state).

- [ ] **Step 6: Wire into app**

Add `await app.register(invitationsRoutes)` (or import via aggregator `social/index.ts`) in the server entry — match existing route registration pattern.

- [ ] **Step 7: Run all tests + commit**

```bash
pnpm --filter server test && pnpm --filter server test:integration
git add apps/server/src/features/social/invitations apps/server/src/<entry-file>
git commit -m "feat(invitations): GET /users/me/invite + POST /invitations/accept (+100 XP)"
```

---

### Task 5: Friendships module

**Files:**
- Create: `apps/server/src/features/social/friendships/friendships.repository.ts`
- Create: `apps/server/src/features/social/friendships/friendships.service.ts`
- Create: `apps/server/src/features/social/friendships/friendships.route.ts`
- Create: tests for both

- [ ] **Step 1: Repository**

```typescript
import { and, eq, or, sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { friendship } from "@pruvi/db/schema/friendship";

type Db = typeof DbClient;

export class FriendshipsRepository {
  constructor(private db: Db) {}

  async findByUsername(username: string) {
    const rows = await this.db
      .select({ id: user.id, name: user.name, username: user.username, image: user.image })
      .from(user)
      .where(eq(sql`LOWER(${user.username})`, username.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  }

  async findExistingPair(a: string, b: string) {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const rows = await this.db
      .select()
      .from(friendship)
      .where(and(
        sql`LEAST(${friendship.requesterId}, ${friendship.recipientId}) = ${lo}`,
        sql`GREATEST(${friendship.requesterId}, ${friendship.recipientId}) = ${hi}`,
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  async createRequest(requesterId: string, recipientId: string) {
    const [row] = await this.db.insert(friendship).values({ requesterId, recipientId, status: "pending" }).returning();
    return row!;
  }

  async getRequest(id: number, recipientId: string) {
    const rows = await this.db
      .select()
      .from(friendship)
      .where(and(eq(friendship.id, id), eq(friendship.recipientId, recipientId), eq(friendship.status, "pending")))
      .limit(1);
    return rows[0] ?? null;
  }

  async respond(id: number, action: "accept" | "decline") {
    await this.db
      .update(friendship)
      .set({ status: action === "accept" ? "accepted" : "declined", acceptedAt: action === "accept" ? new Date() : null })
      .where(eq(friendship.id, id));
  }

  async listAccepted(userId: string) {
    return this.db
      .select({
        friendshipId: friendship.id,
        otherUserId: sql<string>`CASE WHEN ${friendship.requesterId} = ${userId} THEN ${friendship.recipientId} ELSE ${friendship.requesterId} END`.as("other_user_id"),
      })
      .from(friendship)
      .where(and(or(eq(friendship.requesterId, userId), eq(friendship.recipientId, userId)), eq(friendship.status, "accepted")));
  }

  async listAcceptedFriendsWithUserData(userId: string) {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
      })
      .from(friendship)
      .innerJoin(
        user,
        sql`${user.id} = CASE WHEN ${friendship.requesterId} = ${userId} THEN ${friendship.recipientId} ELSE ${friendship.requesterId} END`,
      )
      .where(and(or(eq(friendship.requesterId, userId), eq(friendship.recipientId, userId)), eq(friendship.status, "accepted")));
    return rows;
  }

  async listIncomingRequests(userId: string) {
    return this.db
      .select({
        id: friendship.id,
        createdAt: friendship.createdAt,
        from: {
          id: user.id,
          name: user.name,
          username: user.username,
          image: user.image,
        },
      })
      .from(friendship)
      .innerJoin(user, eq(user.id, friendship.requesterId))
      .where(and(eq(friendship.recipientId, userId), eq(friendship.status, "pending")));
  }

  async deletePair(a: string, b: string) {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    await this.db
      .delete(friendship)
      .where(and(
        sql`LEAST(${friendship.requesterId}, ${friendship.recipientId}) = ${lo}`,
        sql`GREATEST(${friendship.requesterId}, ${friendship.recipientId}) = ${hi}`,
      ));
  }
}
```

- [ ] **Step 2: Service**

```typescript
import { ok, err, type Result } from "neverthrow";
import { AppError, NotFoundError, ValidationError } from "../../../utils/errors";
import type { FriendshipsRepository } from "./friendships.repository";

export class FriendshipsService {
  constructor(private repo: FriendshipsRepository) {}

  async requestByUsername(requesterId: string, username: string): Promise<Result<{ requestId: number; recipient: { username: string | null; name: string } }, AppError>> {
    const target = await this.repo.findByUsername(username);
    if (!target) return err(new NotFoundError("User not found"));
    if (target.id === requesterId) return err(new ValidationError("Cannot friend yourself"));
    const existing = await this.repo.findExistingPair(requesterId, target.id);
    if (existing) return err(new ValidationError(`Friendship already exists with status ${existing.status}`));
    const row = await this.repo.createRequest(requesterId, target.id);
    return ok({ requestId: row.id, recipient: { username: target.username, name: target.name } });
  }

  async respond(id: number, action: "accept" | "decline", userId: string): Promise<Result<{ status: "accepted" | "declined" }, AppError>> {
    const req = await this.repo.getRequest(id, userId);
    if (!req) return err(new NotFoundError("Request not found"));
    await this.repo.respond(id, action);
    return ok({ status: action === "accept" ? "accepted" : "declined" });
  }

  async listFriends(userId: string) {
    return ok({ friends: await this.repo.listAcceptedFriendsWithUserData(userId) });
  }

  async listRequests(userId: string) {
    const rows = await this.repo.listIncomingRequests(userId);
    return ok({ incoming: rows.map((r) => ({ id: r.id, from: r.from, createdAt: r.createdAt.toISOString() })) });
  }

  async unfriend(userId: string, otherUserId: string): Promise<Result<void, AppError>> {
    await this.repo.deletePair(userId, otherUserId);
    return ok(undefined);
  }
}
```

- [ ] **Step 3: Route**

5 endpoints, matching the spec API surface. Match existing route patterns.

- [ ] **Step 4: Unit + integration tests**

Service tests: self-friend rejected, duplicate-pair rejected with each existing status, accept/decline transitions, listFriends respects direction (both columns).

Integration tests: pair UNIQUE index prevents reverse-duplicates (insert (a,b), insert (b,a) fails), CHECK constraints (self-pair, invalid status).

- [ ] **Step 5: Wire + commit**

```bash
pnpm --filter server test && pnpm --filter server test:integration
git add apps/server/src/features/social/friendships
git commit -m "feat(friendships): request/respond/list/unfriend endpoints"
```

---

### Task 6: Ranking module

**Files:**
- Create: `apps/server/src/features/social/ranking/ranking.repository.ts`
- Create: `apps/server/src/features/social/ranking/ranking.service.ts`
- Create: `apps/server/src/features/social/ranking/ranking.route.ts`
- Create: tests

- [ ] **Step 1: Repository — single SQL with friends CTE + LEFT JOIN to review_log**

```typescript
import { sql } from "drizzle-orm";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

export interface RawRankingRow {
  user_id: string;
  name: string;
  username: string | null;
  image: string | null;
  weekly_xp: number;
}

export class RankingRepository {
  constructor(private db: Db) {}

  async getFriendsRanking(userId: string, weekStart: Date): Promise<RawRankingRow[]> {
    const result = await this.db.execute<RawRankingRow>(sql`
      WITH friends AS (
        SELECT CASE WHEN requester_id = ${userId} THEN recipient_id ELSE requester_id END AS friend_id
        FROM friendship
        WHERE (requester_id = ${userId} OR recipient_id = ${userId}) AND status = 'accepted'
      )
      SELECT
        u.id AS user_id, u.name, u.username, u.image,
        COALESCE(SUM(rl.xp_earned), 0)::int AS weekly_xp
      FROM "user" u
      LEFT JOIN review_log rl
        ON rl.user_id = u.id AND rl.reviewed_at >= ${weekStart}
      WHERE u.id = ${userId} OR u.id IN (SELECT friend_id FROM friends)
      GROUP BY u.id, u.name, u.username, u.image
      ORDER BY weekly_xp DESC, u.id ASC
    `);
    // Drizzle's execute() returns shape per driver: { rows: [...] } on pg, Array on PGlite.
    // Normalize:
    return Array.isArray(result) ? result : (result as { rows: RawRankingRow[] }).rows;
  }
}
```

- [ ] **Step 2: Service — trim to 10 around me**

```typescript
import { startOfWeekBrt } from "@pruvi/shared";
import type { RankingRepository } from "./ranking.repository";

export class RankingService {
  constructor(private repo: RankingRepository) {}

  async getRanking(userId: string, now: Date) {
    const weekStart = startOfWeekBrt(now);
    const rows = await this.repo.getFriendsRanking(userId, weekStart);

    const ranked = rows.map((r, i) => ({
      userId: r.user_id,
      name: r.name,
      username: r.username,
      image: r.image,
      weeklyXp: r.weekly_xp,
      rank: i + 1,
      isMe: r.user_id === userId,
    }));

    let entries = ranked;
    if (ranked.length > 10) {
      const meIdx = ranked.findIndex((e) => e.isMe);
      // Take 5 above + 4 below (10 total including me), clamp at edges.
      const start = Math.max(0, Math.min(ranked.length - 10, meIdx - 5));
      entries = ranked.slice(start, start + 10);
    }

    return {
      weekStart: weekStart.toISOString(),
      entries,
    };
  }
}
```

- [ ] **Step 3: Route**

```typescript
// GET /users/me/friends/ranking
```

- [ ] **Step 4: Unit + integration tests**

Service unit: trim with >10 friends (me at top, middle, bottom — clamp behavior). Service with <11 returns all sorted.

Repository integration: seed 1 user + 3 friends + review_log rows spanning current week + previous week + non-friends. Assert query returns only friends + me, only current week XP summed, non-friends excluded.

- [ ] **Step 5: Wire + commit**

```bash
pnpm --filter server test && pnpm --filter server test:integration
git add apps/server/src/features/social/ranking
git commit -m "feat(ranking): GET /users/me/friends/ranking weekly XP"
```

---

### Task 7: Reviews-service `xpEarned` integration

**Files:**
- Modify: `apps/server/src/features/reviews/reviews.repository.ts` — `insertReview` accepts/persists `xpEarned`
- Modify: `apps/server/src/features/reviews/reviews.service.ts` — pass `xpAwarded` into the insertReview call
- Modify: `apps/server/src/features/reviews/reviews.service.test.ts`

- [ ] **Step 1: Repository — extend insertReview**

Find `insertReview` in `reviews.repository.ts`. Add `xpEarned` to its argument type and the INSERT payload.

- [ ] **Step 2: Service — pass xpAwarded through**

In `reviews.service.ts`, where `insertReview(...)` is called, include `xpEarned: xpAwarded` in the args object.

- [ ] **Step 3: Update tests**

In `reviews.service.test.ts`, the `insertReview` mock should now expect the new field. Update assertions accordingly.

- [ ] **Step 4: Commit**

```bash
pnpm --filter server test && pnpm --filter server test:integration
git add apps/server/src/features/reviews
git commit -m "feat(reviews): persist xpEarned per answer for weekly ranking"
```

---

### Task 8: Username profile endpoint

**Files:**
- Modify or create: `apps/server/src/features/users/users.service.ts` (or new `profile.service.ts`)
- Add `PATCH /users/me/profile` route

- [ ] **Step 1: Locate or create the user-profile endpoint**

Search `grep -rn "users/me" apps/server/src/features` for an existing profile route. If one exists, extend it; if not, add a small `profile.route.ts` under `apps/server/src/features/users/`.

- [ ] **Step 2: Implement**

Body: `{ username }`. Service:
- Validate via `UpdateProfileBodySchema` (Fastify-Zod handles this).
- Reject if username already taken by another user (catch UNIQUE violation → 409).
- UPDATE `user.username = lowercased input` (it's already validated lowercase, but defensive `.toLowerCase()` is cheap).
- Return updated user shape.

- [ ] **Step 3: Tests + commit**

Unit: rejects collision, accepts valid username.
Integration: lookup by username case-insensitive works after set (covered in friendships tests too).

```bash
git add apps/server/src
git commit -m "feat(users): PATCH /users/me/profile username"
```

---

### Task 9: Final verification + push

- [ ] **Step 1: Full test sweep**

```bash
pnpm --filter server test
pnpm --filter server test:integration
pnpm --filter @pruvi/shared test
pnpm verify:migration
pnpm check-types
```

All must pass. `sm2.test.ts` pre-existing failures are acceptable (documented tech debt).

- [ ] **Step 2: Worker boot smoke**

```bash
pnpm dev:worker
# Ctrl-C after seeing "queues registered" / "worker started" logs
```

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feature/phase-2d-social-ranking
gh pr create --base main --title "feat: phase 2d — social ranking (friendships + invitations + weekly XP)" --body "..."
```

PR body: summarize the 3 modules, list the 10 endpoints, note deferred items (overtaken-notification, sharing card, block flow), reference the spec.

---

## Self-review

**Spec coverage:**
- ✅ Friendship table + pair-uniqueness → Task 2
- ✅ Invitation acceptance + +100 XP → Task 4
- ✅ Per-user invite code → Tasks 2 + 3 + 4
- ✅ Friend search by username → Tasks 2 + 5
- ✅ Friend request flow → Task 5
- ✅ Weekly XP ranking → Tasks 6 + 7
- ✅ Username setting → Task 8
- ✅ Cache invalidation → folded into Tasks 5 + 7 (no-op without Redis; documented in spec)
- ⏳ Overtaken notification → deferred (explicit in spec)
- ⏳ Sharing card → out of backend scope

**Placeholder scan:** No "TBD" / "add appropriate". Each step has either explicit code or a precise instruction (e.g., "search for the canonical pattern in tokens.route.ts").

**Type consistency:** `username` text NULL, `inviteCode` text NOT NULL, `friendship.status` enum 3 values, `xpEarned` NOT NULL DEFAULT 0 — referenced consistently across schema, shared schemas, repository methods, and service contracts.

**Out-of-codebase callouts:** The plan refers to `authGuard`, `handleResult`, `db` — these are codebase conventions. Implementer agents must look them up rather than invent.
