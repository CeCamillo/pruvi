# Phase 0 — Schema Drift & Coherence Fixes

**Date:** 2026-05-10
**Author:** brainstorming session
**Status:** Draft → pending user review

---

## Context

The `main` branch backend has structural drift between three layers:

1. **Deployed migration** (`packages/db/src/migrations/0000_tranquil_blockbuster.sql`)
2. **Drizzle TypeScript schemas** (`packages/db/src/schema/*.ts`)
3. **Repository code** (`apps/server/src/features/*/`)

Concrete inconsistencies (see `docs/backend-audit-main.md` for full audit):

- `daily_session`: migration has `question_count`/`correct_count`/`status`; TS schema declares `questionsAnswered`/`questionsCorrect`/`date` and omits `status`. Repository writes `{ status, questionCount, correctCount }`.
- `question`: migration column is `content`; TS schema declares `body`. Hard column-name mismatch.
- `question.difficulty`: migration is `text`, TS schema is `integer`. Seed inserts strings.
- Two `review_log` schema files coexist (`review-log.ts` matches migration, `review-logs.ts` is stale). `schema/index.ts` re-exports the stale one.
- `user` table: migration adds `lives`, `lives_reset_at`, `total_xp`, `current_level`; TS `auth.ts` doesn't declare them. Repositories access fields the TS schema doesn't type.

Beyond schema, three coherence gaps:

- `@pruvi/env/src/server.ts` doesn't declare `PORT` despite `src/index.ts` reading `env.PORT`.
- `@pruvi/shared/src/auth.ts` is misnamed — actually exports answer/streak schemas.
- `src/worker.ts` (BullMQ session-prefetch worker) is not in the Dockerfile. In container deploys, jobs accumulate forever.

**Confirmed state:** No production data. Database is dev/local only. Clean-slate regeneration is safe.

---

## Goals

Make the Drizzle TypeScript schemas the single source of truth, regenerate one clean migration aligned with them, and resolve related coherence issues so any subsequent feature work builds on a coherent foundation.

This is a **non-functional refactor**. No endpoint behavior changes. Same SM-2, same XP rules, same lives mechanic, same auth flow.

---

## Scope

### In scope

1. **Schema reconciliation** — fix all 4 drifted Drizzle schema files, delete the duplicate `review-logs.ts`, lock in canonical column names.
2. **Migration regeneration** — delete the existing migration, run `drizzle-kit generate` to produce a fresh single migration, re-verify seed script.
3. **Env validation** — add `PORT` to `@pruvi/env/src/server.ts`.
4. **`@pruvi/shared/auth.ts` rename** — split into `answers.ts` and `streaks.ts`, update re-exports and consumers.
5. **Docker split** — single image, two CMDs. Entrypoint shell script branches on `PROCESS_TYPE` env var.

### Explicitly out of scope

- Lives refill mechanic change (Phase 2)
- SM-2 quality grading refinement (deliberate simplification)
- Onboarding columns (Phase 1)
- Google OAuth (Phase 1)
- Any new product features
- Health probes for the worker container (note for follow-up)

---

## Canonical Naming Decisions

| Table | Decision | Rationale |
|---|---|---|
| `question.content` | Keep `content` (rename TS `body` → `content`) | Matches seed file + deployed migration; more semantically accurate than `body`. |
| `question.difficulty` | `text({ enum: ["easy","medium","hard"] })` | Matches seed and migration. Drizzle enum gives TS safety without PG enum type. |
| `daily_session.questions_answered` / `daily_session.questions_correct` | Use descriptive names (rename migration's `question_count`/`correct_count`) | More accurate semantics; we're regenerating the migration anyway. |
| `daily_session.date` | **Drop** | `created_at::date` derives the same info. Existing index `(user_id, created_at)` supports streak queries. |
| `daily_session.status` | Keep `status text` with `"active" \| "completed"` union | Repository depends on it. |
| `review_log` schema file | Keep `review-log.ts`, delete `review-logs.ts` | `review-log.ts` matches migration shape (`easinessFactor` decimal, `reviewedAt`). |
| `user` gamification columns | Add `lives`, `livesResetAt`, `totalXp`, `currentLevel` to `auth.ts` TS schema | Migration already has them; TS schema must catch up. |

---

## Architecture & File Changes

### `packages/db/`

- `src/schema/auth.ts` — extend `user` table with `lives: integer().default(5).notNull()`, `livesResetAt: timestamp({ withTimezone: true })`, `totalXp: integer().default(0).notNull()`, `currentLevel: integer().default(1).notNull()`.
- `src/schema/questions.ts` — rename `body`→`content`, change `difficulty` from `integer` to `text({ enum: ["easy","medium","hard"] })`.
- `src/schema/daily-sessions.ts` — rename columns to `questions_answered`/`questions_correct`, drop `date` column, add `status: text({ enum: ["active","completed"] }).default("active").notNull()`.
- `src/schema/review-log.ts` — kept as-is.
- `src/schema/review-logs.ts` — **deleted**.
- `src/schema/index.ts` — re-export from `./review-log`.
- `src/migrations/0000_tranquil_blockbuster.sql` — **deleted**.
- `src/migrations/meta/_journal.json` — regenerated.
- `src/seed.ts` — verify column references still resolve.

### `packages/env/`

- `src/server.ts` — add `PORT: z.coerce.number().int().positive().default(3000)` to the env schema.

### `packages/shared/`

- `src/auth.ts` — **deleted**.
- `src/answers.ts` — new file, contains `AnswerQuestionBodySchema`, `AnswerQuestionResponseSchema`.
- `src/streaks.ts` — new file, contains `StreakResponseSchema`.
- `src/index.ts` — update re-exports.

### `apps/server/`

- `src/features/sessions/sessions.repository.ts` — rename field accesses (`questionCount` → `questionsAnswered`, etc.).
- `src/features/reviews/reviews.service.ts` and `.repository.ts` — verify all access paths.
- `src/features/lives/lives.repository.ts` — verify; should be no changes since column names match.
- `src/features/gamification/gamification.repository.ts` — verify.
- `src/features/streaks/streaks.service.ts` — verify `daily_session.created_at` access path.
- `package.json` — add scripts `start:server` (runs `dist/index.mjs`) and `start:worker` (runs `dist/worker.mjs`).

### Root

- `Dockerfile` — final stage uses a thin entrypoint shell script. The script branches:
  ```sh
  #!/bin/sh
  if [ "$PROCESS_TYPE" = "worker" ]; then
    exec bun run dist/worker.mjs
  else
    exec bun run dist/index.mjs
  fi
  ```
  Build step must produce both `dist/index.mjs` and `dist/worker.mjs`. Verify `tsdown` config emits both, or add a second build entry.

---

## Testing

1. **Existing test suite** — `pnpm -r test` (Vitest). Any tests referencing old column names are updated in the same diff.
2. **Type-check** — `pnpm -r typecheck`. Drizzle's inferred types are our primary safety net; TS compile errors will flag every code path that doesn't match the new schema.
3. **Migration smoke test** — script (`scripts/verify-migration.ts` or CI inline) that spins up a fresh Postgres (Docker), runs `drizzle-kit migrate`, runs the seed, executes one representative query per repository (sessions, lives, XP, streaks, reviews).
4. **Docker build verification** — `docker build .` succeeds; `docker run -e PROCESS_TYPE=server <img>` and `docker run -e PROCESS_TYPE=worker <img>` both start cleanly (no immediate crash).
5. **No new feature tests** — Phase 0 is a refactor. Relies on existing coverage.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Regenerated migration has a different filename | Local-only state; no external refs. Accept whatever `drizzle-kit` names it. |
| Seed script breaks on new column names | Migration smoke test catches this. Run seed as part of the test. |
| Repositories silently use old column names | TS type-check catches all mismatches at compile time. |
| Docker entrypoint shell-quoting bugs | Use `exec` form, test locally, keep script ~5 lines. |
| `tsdown` doesn't support multi-entry compile natively | Fall back to two `tsdown` invocations in the build script. |
| Worker container has no health probe | Out of scope; note as Phase 0.1 if needed later. |

---

## Rollout

**Single PR.** The schema regen, env fix, shared rename, and Dockerfile split are tightly coupled — splitting into multiple PRs creates broken intermediate states.

**Definition of done:**

- [ ] All TS schema files match the canonical naming above
- [ ] One fresh migration file, regenerated via `drizzle-kit generate`
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm -r test` passes
- [ ] Migration smoke test passes (fresh DB → migrate → seed → query)
- [ ] `docker build` succeeds; both `PROCESS_TYPE=server` and `PROCESS_TYPE=worker` start cleanly
- [ ] `PORT` is validated in `@pruvi/env`
- [ ] `@pruvi/shared` exports `answers.ts` + `streaks.ts`; `auth.ts` is gone
- [ ] No references to `review-logs.ts` remain anywhere in the codebase

---

## Out-of-Band Notes

- After Phase 0 lands, the next priorities (per audit) are: onboarding columns + endpoints, Google OAuth, `GET /subjects`, `PUT /users/me/profile`, `DELETE /users/me`, question bank expansion. Those become Phase 1.
- The worker container will eventually need a health probe and a metrics endpoint — flag for Phase 0.1 or roll into Phase 2 observability work.
- This spec deliberately avoids touching the SM-2 quality binary mapping (`correct ? 4 : 1`). Spec audit flagged it as a simplification; refining it is a product/UX decision, not a coherence fix.
