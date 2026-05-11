# Phase 1C — Progress & Calendar Endpoints

**Date:** 2026-05-10
**Author:** brainstorming session
**Status:** Draft → pending user review
**Depends on:** Phase 1A (`phase-1a-onboarding-identity` branch / PR #11)

---

## Context

The frontend's "Progress" screen needs two read-only endpoints: per-subject lifetime accuracy and an activity calendar over a date range. The audit (`docs/backend-audit-main.md`) flagged both as missing — Phase 1C closes that gap.

Phase 1B (subjects + content expansion) and Phase 1C (this) are independent and could ship in either order. 1C is chosen first because it's pure code work — no content-ops dependency.

Per spec 6.2: "Lista de matérias com barra de progresso (% de tópicos em 'Afiado' ou 'Quase mestre'). Calendário de atividade (referência: GitHub contribution graph)." This phase delivers the data shapes that screen renders.

---

## Goals

Two endpoints that read aggregated data from `review_log` and `daily_session`:
- `GET /users/me/progress` — global + per-subject lifetime accuracy
- `GET /users/me/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` — distinct completed-session dates in range

After this phase ships, the frontend can render a progress screen with per-subject accuracy bars and a GitHub-style activity heatmap.

---

## Scope

### In scope

1. **New feature module** `apps/server/src/features/progress/` (repository, service, route, tests)
2. **Shared schemas** in `packages/shared/src/progress.ts` (response/query Zod schemas)
3. **Cache invalidation** of `progress:{userId}` after `POST /questions/:id/answer` (one-line addition in `reviews.route.ts`)
4. **Server wiring** in `apps/server/src/index.ts`

### Explicitly out of scope

- Topic-level granularity (no `topic` table yet — Phase 2)
- Mastery state computation (Aprendendo / Entendendo / Afiado / Quase mestre — Phase 2)
- Rolling-window accuracy ("last 30 reviews" — deferred until frontend wants the trend view)
- Per-day session counts (current `daily_session` is one-per-day; adding count is wasted complexity until that constraint changes)
- User-timezone-aware date bucketing (uses server-local timezone like the existing streak logic; Phase 2 timezone work fixes both together)
- Yearly heatmap render hints (frontend renders directly from the date array)

---

## API Contracts

### `GET /users/me/progress`

Auth required.

**Response:**
```typescript
{
  totalReviews: number,
  totalCorrect: number,
  accuracy: number,           // 0..1; 0 if totalReviews=0
  bySubject: Array<{
    subjectSlug: string,
    subjectName: string,
    totalReviews: number,
    totalCorrect: number,
    accuracy: number,         // 0..1; 0 if totalReviews=0
  }>,
}
```

- `accuracy` is a float 0-1 (frontend formats display).
- `bySubject` includes only subjects the user has reviewed at least once. Sorted by `subjectName` ASC.
- A review is "correct" iff `review_log.quality >= 3` (canonical SM-2 threshold; currently equivalent to `quality === 4` since the codebase only writes 4 or 1).
- Cached 300s under `progress:{userId}`. Invalidated by `POST /questions/:id/answer`.

### `GET /users/me/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`

Auth required.

**Query params:**
- `from`: ISO date `YYYY-MM-DD`, required
- `to`: ISO date `YYYY-MM-DD`, required, must be `>= from`

**Response:**
```typescript
{ dates: string[] }    // ISO YYYY-MM-DD, sorted ascending
```

- Inclusive on both ends.
- Returns empty array if no completed sessions in range.
- Hard cap: 400 days. Beyond that returns 400 with `RANGE_TOO_LARGE`.
- A date is "active" iff at least one `daily_session` row with `status = 'completed'` and `created_at::date` in range.
- Cached 60s under `calendar:{userId}:{from}:{to}`. Not actively invalidated (TTL is acceptable).

---

## Architecture

### New feature module

`apps/server/src/features/progress/`:

| File | Responsibility |
|---|---|
| `progress.repository.ts` | Drizzle queries: aggregated review stats joined to subject; distinct completed-session dates in range |
| `progress.service.ts` | `getProgress(userId)`, `getCalendar(userId, from, to)` with `neverthrow` Results, range validation, accuracy computation |
| `progress.route.ts` | Fastify routes with Zod validation and Redis caching |
| `index.ts` | Re-export `progressRoutes` |
| `progress.service.test.ts` | Unit tests with mocked repo |
| `progress.repository.integration.test.ts` | Vitest + PGlite |

### New shared schemas

`packages/shared/src/progress.ts`:

```typescript
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const SubjectProgressSchema = z.object({
  subjectSlug: z.string(),
  subjectName: z.string(),
  totalReviews: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});

export type SubjectProgress = z.infer<typeof SubjectProgressSchema>;

export const ProgressResponseSchema = z.object({
  totalReviews: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
  bySubject: z.array(SubjectProgressSchema),
});

export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;

export const CalendarQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
});

export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export const CalendarResponseSchema = z.object({
  dates: z.array(isoDate),
});

export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
```

Plus `export * from "./progress";` in `packages/shared/src/index.ts`.

### Queries

**Lifetime progress** — single round-trip:

```sql
SELECT
  subject.slug,
  subject.name,
  COUNT(*) AS total_reviews,
  SUM(CASE WHEN review_log.quality >= 3 THEN 1 ELSE 0 END)::int AS total_correct
FROM review_log
JOIN question ON question.id = review_log.question_id
JOIN subject ON subject.id = question.subject_id
WHERE review_log.user_id = $1
GROUP BY subject.id, subject.slug, subject.name
ORDER BY subject.name ASC;
```

Service computes per-row `accuracy = totalCorrect / totalReviews` (0 when reviews=0) and aggregates the totals across subjects.

**Calendar dates** — single round-trip:

```sql
SELECT DISTINCT (created_at::date)::text AS day
FROM daily_session
WHERE user_id = $1
  AND status = 'completed'
  AND created_at >= $2::timestamp
  AND created_at <  ($3::date + INTERVAL '1 day')::timestamp
ORDER BY day ASC;
```

The `< (to + 1 day)` form keeps `to` inclusive. Dates returned as ISO strings.

### Caching

| Endpoint | Key | TTL | Invalidation |
|---|---|---|---|
| `GET /users/me/progress` | `progress:{userId}` | 300s | On `POST /questions/:id/answer` |
| `GET /users/me/calendar` | `calendar:{userId}:{from}:{to}` | 60s | TTL-only (acceptable staleness) |

Invalidation lives in `reviews.route.ts` (one-line `fastify.cache.del(\`progress:${request.userId}\`)` after the answer mutation).

### Server wiring

`apps/server/src/index.ts`:
- Import `progressRoutes` from `./features/progress`
- Register `await app.register(progressRoutes);` after the existing feature routes

---

## Testing

| Layer | What | How |
|---|---|---|
| Unit | `getProgress` aggregates correctly; accuracy=0 when no reviews | Vitest + mocked repo |
| Unit | `getCalendar` rejects `to < from` (`VALIDATION_ERROR`) | Vitest + mocked repo |
| Unit | `getCalendar` rejects range > 400 days (`RANGE_TOO_LARGE`) | Vitest + mocked repo |
| Integration | `getProgress` query: seed 2 subjects + 3 review_logs (2 correct, 1 wrong on subjA) → correct aggregates | Vitest + PGlite |
| Integration | `getCalendar` query: seed 3 daily_sessions (2 completed, 1 active across 3 dates) → returns 2 dates | Vitest + PGlite |

Zod-level malformed-date validation happens at the route layer — not tested separately in the service.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `created_at::date` ignores user timezone — dates near midnight UTC may shift | Documented as known. Phase 2 timezone work fixes streak + progress + calendar together. |
| Cache invalidation in `reviews.route.ts` couples reviews to progress | One-line `del`. Tolerable. Event-driven invalidation is overkill. |
| 400-day range cap is arbitrary | Covers leap years + grace; easy to bump if frontend asks for more. |
| Empty `bySubject` array when user has zero reviews | Frontend renders empty state; not an error. Covered by test. |
| Integration test for cache may be flaky if Redis isn't running | TTL alone is acceptable correctness; cache-invalidation integration test is optional. |
| `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` returns a string in pg | Cast to `::int` in SQL; Drizzle then returns `number`. |

---

## Rollout

**Single PR stacked on `phase-1a-onboarding-identity`.** Phase 1C is independent of Phase 1A's changes; rebase risk is minimal.

If Phase 1A merges to `main` first, rebase 1C onto `main` cleanly.

### Definition of Done

- [ ] `progress/` feature module created with all 6 files
- [ ] `@pruvi/shared/progress.ts` created and re-exported
- [ ] Both endpoints respond correctly per spec
- [ ] Range validation works (`to >= from`, 400-day cap)
- [ ] `reviews.route.ts` invalidates `progress:{userId}` after answer write
- [ ] ~6 new unit tests pass
- [ ] ~2 new integration tests pass
- [ ] `pnpm verify:migration` still passes
- [ ] No regression in existing endpoints

---

## Out-of-Band Notes

The `quality >= 3` threshold for "correct" is the canonical SM-2 distinction. The codebase currently only writes `quality = 4` (correct) or `quality = 1` (wrong), making the threshold equivalent to `quality === 4` today. Using the threshold makes the endpoint correct against future SM-2 grading refinements.

Timezone semantics for both endpoints follow the existing streak logic (server-local time). Spec 6.1 mentions user-timezone-aware streak resets as a future improvement — when that lands, this phase's `created_at::date` casts need to update in lockstep.

After Phase 1C lands, the remaining audit gaps in Phase 1 are content-shaped (Phase 1B): `GET /subjects`, question `explanation` column, question bank expansion to 500+.
