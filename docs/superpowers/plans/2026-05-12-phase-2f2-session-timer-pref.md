# Phase 2F.2 — Session timer toggle preference — Plan

Branch: `feature/phase-2f2-session-timer-pref`. Spec: `docs/superpowers/specs/2026-05-12-phase-2f2-session-timer-pref-design.md`.

## File map

**Create:**
- `apps/server/src/features/users/session-preferences.repository.ts` + `.test.ts`
- `apps/server/src/features/users/session-preferences.route.ts`
- `apps/server/src/features/users/session-preferences.integration.test.ts`
- New migration `0013_*.sql` (drizzle-kit generated)

**Modify:**
- `packages/db/src/schema/auth.ts` — add `showTimer` column.
- `packages/shared/src/users.ts` — add `SessionPreferencesSchema` + `UpdateSessionPreferencesBodySchema`.
- `apps/server/src/server.ts` (or wherever routes register) — register the new route.

## Tasks

### Task 1: Schema + migration

- Add `showTimer: boolean("show_timer").notNull().default(true)` to `user` in `packages/db/src/schema/auth.ts` after `notificationHour`.
- `bun --cwd packages/db run db:generate` → produces `0013_*.sql`. Verify it has `ALTER TABLE "user" ADD COLUMN "show_timer" boolean DEFAULT true NOT NULL`.
- `bun --cwd packages/db run db:migrate` to apply locally.
- Update `apps/server/src/test/db-helpers.ts` only if needed (no new table — no truncation change required).
- Commit: `feat(db): add user.show_timer column for session timer toggle`.

### Task 2: Shared schemas

- Append to `packages/shared/src/users.ts`:

```ts
export const SessionPreferencesSchema = z.object({
  showTimer: z.boolean(),
});
export type SessionPreferences = z.infer<typeof SessionPreferencesSchema>;
export const UpdateSessionPreferencesBodySchema = SessionPreferencesSchema;
```

- Commit: `feat(shared): add session preferences schemas`.

### Task 3: Repository + tests

- `session-preferences.repository.ts`:

```ts
import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db as DbClient } from "@pruvi/db";

type Db = typeof DbClient;

export class SessionPreferencesRepository {
  constructor(private db: Db) {}

  async get(userId: string): Promise<{ showTimer: boolean } | null> {
    const rows = await this.db
      .select({ showTimer: user.showTimer })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async update(userId: string, patch: { showTimer: boolean }): Promise<{ showTimer: boolean } | null> {
    const rows = await this.db
      .update(user)
      .set({ showTimer: patch.showTimer })
      .where(eq(user.id, userId))
      .returning({ showTimer: user.showTimer });
    return rows[0] ?? null;
  }
}
```

- Integration test (`session-preferences.integration.test.ts`) — seed a user, assert default `showTimer === true`, update to `false`, re-read returns `false`. Use the existing `insertUser` pattern from other integration tests.
- Commit: `feat(users): session-preferences repository`.

### Task 4: Route + caching

- `session-preferences.route.ts` — mirror `notifications/preferences.route.ts` exactly:

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { UpdateSessionPreferencesBodySchema, SessionPreferencesSchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { ok, err, type Result } from "neverthrow";
import { AppError, NotFoundError } from "../../utils/errors";
import { SessionPreferencesRepository } from "./session-preferences.repository";

const repo = new SessionPreferencesRepository(db);
const TTL = 60;

export const sessionPreferencesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/session-preferences",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: SessionPreferencesSchema }) } },
    },
    async (request) => {
      const cacheKey = `prefs:session:${request.userId}`;
      const cached = await fastify.cache.get<{ showTimer: boolean }>(cacheKey);
      if (cached) return successResponse(cached);
      const row = await repo.get(request.userId);
      if (!row) {
        // Throwing AppError so the error handler returns the right status.
        throw new NotFoundError("User not found");
      }
      await fastify.cache.set(cacheKey, row, TTL);
      return successResponse(row);
    },
  );

  fastify.put(
    "/users/me/session-preferences",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: UpdateSessionPreferencesBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: SessionPreferencesSchema }) },
      },
    },
    async (request) => {
      const updated = await repo.update(request.userId, request.body);
      if (!updated) throw new NotFoundError("User not found");
      await fastify.cache.del(`prefs:session:${request.userId}`);
      return successResponse(updated);
    },
  );
};
```

- Register the route in `apps/server/src/server.ts` (find where `preferencesRoutes` is registered and add `sessionPreferencesRoutes` alongside).
- Commit: `feat(users): session-preferences route with cache invalidation`.

## Gate D

- All ACs pass.
- Existing users get `showTimer = true` after migration.
- PUT invalidates the cache so subsequent GET returns fresh data.
