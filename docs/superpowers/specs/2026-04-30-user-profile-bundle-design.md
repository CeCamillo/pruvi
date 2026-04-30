# User Profile Bundle — Design Spec

**Sub-project:** Tier 1 #2 of the post-inventory implementation roadmap (`docs/feature-inventory.md`).
**Date:** 2026-04-30
**Status:** Approved by user 2026-04-30, pending implementation plan.
**Goal:** Add the missing user-profile fields, expose a single `GET /me` endpoint that bundles everything the home/profile/trail-header screens render today, and stand up a weekly-XP rollup with a Monday-reset cron.

---

## Context

Three separate endpoints (`/users/me/lives`, `/users/me/xp`, `/streaks`) feed the home screen today. The feature inventory's [user] entity captures the full profile surface — name, avatar, plan, weekly + total XP, level, streak, lives, freeze tokens, daily-goal — that the FE wants in a single call. Five fields don't exist on the `user` table yet (`weekly_xp`, `freeze_tokens`, `plan`, `avatar_url`, `daily_goal_minutes`); one column (`daily_study_time`) needs replacing with the integer-minutes form locked in during the data-model decisions pass.

Weekly XP is the meatiest decision: the locked product semantics ("XP gained over time" — i.e., a week, not cumulative) require either a derived rollup or a materialized field. The chosen approach is materialized-with-cron-reset: smallest correct solution, lowest read cost, builds the cron infrastructure that sub-project #6 (tickets) will reuse.

This sub-project sits in Tier 1 (Foundation) because every downstream screen — home, profile, trail-header, achievements — depends on the bundle and its missing fields.

---

## Architectural Approach

A **single bundle endpoint** (`GET /me`) reading from the existing `user` table (extended) plus the existing `dailySession` aggregations used by streaks, all wrapped behind one Redis cache key. The three legacy granular endpoints stay live for backward compatibility; FE callers migrate to `useMe()` per-screen as later sub-projects touch each screen.

Weekly XP is **materialized**: incremented in the same transaction as `totalXp` on every correct answer, reset to 0 by a BullMQ scheduled job at Monday 00:00 `America/Sao_Paulo`. A `weekly_xp_reset_at` column + read-time stale-check provides self-healing for missed cron runs.

Rejected approaches:
- *Derived per request from review_log + question join.* Rolling-7-day semantics differ from "this week" semantics; aggregation per-request is slow even with cache; would require storing `xpAwarded` on review_log.
- *Daily snapshots table.* Better long-term solution that also feeds the calendar heatmap, but belongs in sub-project #4 (Activity & progress depth). YAGNI for Tier 1.

---

## Schema Migration

Add to `user` table:

| Column | Type | NULL? | Default | Notes |
|---|---|---|---|---|
| `weekly_xp` | integer | NOT NULL | `0` | Reset Monday 00:00 BRT by cron |
| `weekly_xp_reset_at` | timestamp | NULL | — | Last reset; powers self-heal |
| `freeze_tokens` | integer | NOT NULL | `0` | Streak-freeze tokens (consumed in future sub-project) |
| `plan` | text | NOT NULL | `'free'` | `'free' \| 'premium'` (text, enum migration is a future cleanup) |
| `avatar_url` | text | NULL | — | URL only; upload pipeline is a future sub-project |
| `daily_goal_minutes` | integer | NULL | — | Replaces `daily_study_time` |

Drop after backfill: `daily_study_time` (text).

**Backfill (same migration, after column add, before column drop):**

```sql
UPDATE "user" SET daily_goal_minutes = CASE daily_study_time
  WHEN '30min' THEN 30
  WHEN '1h'    THEN 60
  WHEN '2h'    THEN 120
  WHEN '3h+'   THEN 180
  ELSE NULL
END WHERE daily_study_time IS NOT NULL;

ALTER TABLE "user" DROP COLUMN daily_study_time;
```

Drizzle schema (`packages/db/src/schema/auth.ts`) is updated to add the new columns and remove `dailyStudyTime`. The onboarding `userPreferencesSchema` and the `POST /onboarding/complete` body schema in `@pruvi/shared` are updated to use `dailyGoalMinutes: z.number().int().min(30).max(180)` instead of the string form.

---

## `GET /me` Endpoint

Single bundle, replaces the three legacy granular calls:

```ts
type MeResponse = {
  // Identity
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  plan: "free" | "premium";

  // Gamification snapshot
  totalXp: number;
  weeklyXp: number;
  currentLevel: number;          // 1–11
  xpForNextLevel: number;        // 0 if at max level
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  lives: number;                 // 0–5
  livesResetAt: string | null;   // ISO 8601

  // Onboarding-derived prefs
  selectedExam: string | null;
  dailyGoalMinutes: number | null;
  onboardingCompleted: boolean;
};
```

- Route: `GET /me` (preferred over `/users/me` to keep the path short and avoid collision with the legacy `/users/me/*` granular routes).
- Auth: standard `authenticate` preHandler.
- Response shape: `successResponse(MeResponse)`.
- 401 when unauthenticated.

`MeService.buildBundle(userId)` composes the response from the user row + streak aggregation + level calculation. Lives auto-refill (existing behavior) is invoked from inside the bundle so we don't drift from the legacy endpoint.

A new shared zod schema `meResponseSchema` is exported from `@pruvi/shared` so the FE service layer can type-check responses.

---

## Weekly XP Rollup

### Write path

`GamificationService.awardXp(userId, n)` becomes:

```sql
UPDATE "user"
   SET total_xp  = total_xp  + $2,
       weekly_xp = weekly_xp + $2
 WHERE id = $1
```

No new write to a separate table. Atomic single-statement update.

### Read path

`weekly_xp` is just a column read; bundled into `/me`. No aggregation, no join.

### Reset cron

- New BullMQ queue `weekly-xp-reset` registered in the worker process.
- Scheduled with `repeat: { pattern: "0 0 * * 1", tz: "America/Sao_Paulo" }` — Monday 00:00 BRT.
- Worker runs `UPDATE "user" SET weekly_xp = 0, weekly_xp_reset_at = NOW()` (single statement, all rows).
- After the SQL update, the worker invalidates the `me:*` cache pattern so the next `/me` reads fresh.
- BullMQ retries on failure (3 attempts, exponential backoff — same config pattern as `session-prefetch`).

### Self-heal

If the cron is skipped (server downtime, Redis eviction, DST jitter), `MeService.buildBundle` checks `weekly_xp_reset_at` against the most recent past-Monday-00:00-BRT boundary:

```ts
const lastMondayBRT = computeLastMondayBoundary(new Date(), "America/Sao_Paulo");
if (!user.weeklyXpResetAt || user.weeklyXpResetAt < lastMondayBRT) {
  // Stale — return 0 in the bundle and queue an out-of-band reset
  fireAndForget(weeklyXpResetQueue.add("self-heal", { userId }));
  return { ...bundle, weeklyXp: 0 };
}
```

The queued self-heal job runs the same single-row UPDATE for that user. Idempotent: if multiple `/me` calls fire before the job runs, all enqueue, all run, all converge.

---

## Caching & Invalidation

Single Redis key per user: `me:{userId}`, TTL 60s. Invalidated by:

| Event | Keys to invalidate |
|---|---|
| `POST /sessions/:id/complete` | `me:{userId}`, `streaks:{userId}` |
| `POST /questions/:id/answer` | `me:{userId}`, `xp:{userId}`, `lives:{userId}` |
| `POST /api/auth/sign-out` | `me:{userId}` (plus existing per-key clears) |
| `PUT /users/me/preferences` | `me:{userId}`, `preferences:{userId}` |
| `POST /onboarding/complete` | `me:{userId}`, `preferences:{userId}` |
| Weekly cron reset | `me:*` (pattern delete after SQL update) |

The legacy granular keys (`xp:{userId}`, `lives:{userId}`, `streaks:{userId}`) continue to be invalidated as they are today — backward compat for callers still using the old endpoints.

---

## Backward Compatibility

- Legacy endpoints `/users/me/lives`, `/users/me/xp`, `/streaks` stay alive and unchanged.
- A code comment near each handler marks it deprecated and points to `GET /me` as the canonical replacement. No HTTP `Sunset` header — the deprecation is internal.
- FE migration to `useMe()` happens incrementally per screen across future sub-projects. When all callers are gone, a later sub-project drops the legacy routes in a single PR.

---

## FE Wiring (in scope)

- New service `apps/native/services/me.service.ts` calling `apiRequest("/me", {}, meResponseSchema)`.
- New hook `apps/native/hooks/useMe.ts`:
  ```ts
  export function useMe() {
    return useQuery({
      queryKey: ["me"] as const,
      queryFn: () => meService.getMe(),
      staleTime: 60_000,
    });
  }
  ```
- New shared zod schema `packages/shared/src/me.ts` exporting `meResponseSchema` and the inferred `MeResponse` type.
- Format helper `apps/native/lib/format-xp.ts` exporting:
  - `formatXpCompact(n: number): string` → `"2.4k"` (used by trail-header badge)
  - `formatXpFull(n: number): string` → `"12,450"` (used by profile total-XP block)
  - Both use `Intl.NumberFormat("pt-BR", ...)` for locale-correct grouping.

**Per-screen migration is OUT OF SCOPE** for this sub-project. The hook + service + helpers ship; future sub-projects swap individual screens to consume them. This avoids coupling this PR to many UI rewrites.

---

## Testing Strategy

| Layer | Tests |
|---|---|
| **Unit (server)** — `MeService.buildBundle` | shape; level=1 cold user; level=11 max user (`xpForNextLevel = 0`); lives auto-refill triggers when `livesResetAt` is past; `weeklyXp` is included; self-heal returns 0 when `weekly_xp_reset_at` is older than last Monday |
| **Integration (server)** — `GET /me` | 200 with full bundle for authenticated user; 401 unauthenticated; cache hit on second call within 60s; cache invalidation after `/questions/:id/answer` |
| **Cron worker** | call worker fn directly with a fixture user, assert `weekly_xp = 0` and `weekly_xp_reset_at` updated for all rows |
| **Migration** | apply on a fixture DB with one row per `daily_study_time` value, assert backfill mapping correct, assert column dropped |
| **FE unit** | `formatXpCompact(2400) === "2.4k"`, `formatXpCompact(12450) === "12.4k"`, `formatXpFull(12450) === "12.450"` (pt-BR uses `.` as thousands separator) |

The hook itself is intentionally not tested — too thin (TanStack Query wrapper).

---

## Edge Cases

- **Cold user (no review_log yet):** `totalXp = 0`, `weeklyXp = 0`, `currentLevel = 1`, `xpForNextLevel = 100`. Tested.
- **Max-level user (`totalXp ≥ 18500`):** `currentLevel = 11`, `xpForNextLevel = 0`. Tested.
- **`livesResetAt` in the past:** lives auto-refill on read (existing behavior); the bundle invokes the same auto-refill path to keep parity with the legacy endpoint.
- **Cron skipped due to downtime:** self-heal returns 0 and enqueues a one-shot reset job for that user.
- **Concurrent answer + cron at 00:00 BRT Monday:** Postgres MVCC handles the race — the answer's increment either lands in the bulk reset or after it, but never gets lost. Drift is bounded to at most one answer per user per Monday.
- **`daily_goal_minutes` for a user mid-onboarding:** can be NULL until they complete the funnel.
- **Plan migrating from text to enum later:** non-breaking, schema migration only.

---

## Out of Scope (Deferred)

- **Per-screen FE migration** — happens as we touch each screen in subsequent sub-projects.
- **Avatar upload pipeline** (camera/gallery picker, S3/Cloudinary, signed URLs).
- **Plan billing logic** (Stripe, subscription state machine, premium gates) — Tier 5.
- **Calendar heatmap / activity feed** (would consume daily snapshots) — Sub-project #4.
- **Streak-freeze consumption logic** — `freezeTokens` field is added; the spend path is a future sub-project.
- **Dropping the legacy granular endpoints** — happens after all FE callers migrate.

---

## Acceptance Criteria

1. Migration applies cleanly on a freshly seeded DB; re-running is idempotent.
2. Backfill correctly maps every existing `daily_study_time` value (`30min → 30`, `1h → 60`, `2h → 120`, `3h+ → 180`); the column is dropped.
3. `GET /me` returns 200 with the typed `MeResponse` shape for an authenticated user; 401 otherwise.
4. Answering a correct question increments both `totalXp` and `weeklyXp` by the same delta in a single SQL statement.
5. Manually triggering the weekly-xp-reset worker sets `weekly_xp = 0` and updates `weekly_xp_reset_at` for all rows.
6. Self-heal: simulating a week-long cron downtime (`weekly_xp_reset_at` set to 8 days ago) makes the next `/me` call return `weeklyXp = 0` and enqueue a reset job.
7. Two consecutive `/me` calls within 60s hit Redis (one DB query); a `/me` call after `/questions/:id/answer` re-fetches.
8. Legacy endpoints (`/users/me/lives`, `/users/me/xp`, `/streaks`) still work and return the same shapes as before.
9. `meResponseSchema` is exported from `@pruvi/shared`.
10. `formatXpCompact` and `formatXpFull` exist in `apps/native/lib/format-xp.ts` with unit tests.

---

## Risks & Open Questions

1. **Timezone correctness for the cron.** `node-cron` and BullMQ both accept `tz`, but DST transitions for `America/Sao_Paulo` are a recurring source of bugs (Brazil currently doesn't observe DST, but this can change by decree). The self-heal mitigates a one-Monday miss; longer drift would still surface in `/me` returning stale data. Worth a follow-up integration test against a fake clock once we touch this again.
2. **Cache pattern delete (`me:*`) is O(N) in Redis.** With the current user count it's fine. At scale (>100k users), pattern-delete is expensive; we'd switch to per-user invalidation in the cron worker (one `DEL` per affected user). YAGNI for now.
3. **`plan` as `text` not enum.** Postgres enums are fragile to add/remove values; text + Zod validation is more flexible early. Tradeoff: typos in code-side strings won't be caught at the DB layer. Mitigated by deriving the value from the `plan` zod enum in the route layer.
