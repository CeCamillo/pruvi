# Phase 6.1 — Roleta (free-play subject-random mode)

> Status: approved design, ready for implementation planning.
> Date: 2026-04-23.
> Integration-map link: Phase 6 ("Content Features"), item 6.1.

## Summary

Introduce a new study mode alongside the daily session. The user configures which subjects are eligible, then each "spin" randomly picks one subject from that pool and serves a 3-question mini-set from it. Roleta is pure practice: no lives consumed, XP awarded at half rate, and answers are recorded to `review_log` for accuracy stats but do not feed SM-2 rescheduling.

This is the first content feature beyond the core daily loop. It validates that our session mechanics compose into distinct modes without contaminating the SM-2 engine.

## Goals

- Ship a second study mode that feels meaningfully different from the daily session, with minimum new infrastructure.
- Keep the daily session as the authoritative SM-2 learning loop. Roleta cannot advance scheduling or burn lives.
- Reuse the daily session's option-card UI verbatim (refactored into a shared component).
- Preserve real-backend wiring (zero mock screens).

## Non-goals

- Physics-accurate wheel animation. A simple 1.2 s rotation is enough.
- Consecutive-spin streak or roleta-specific missions.
- Difficulty filtering inside Roleta. Config is subject-only.
- Sharing results externally.

## Data model

### 1. `user.roleta_subjects` (new column)

```sql
ALTER TABLE "user" ADD COLUMN "roleta_subjects" jsonb;
```

- Nullable. When null, Roleta defaults to "all 5 subjects eligible" behaviour.
- When set: a `jsonb` array of subject slugs, length 1-5. Matches the `difficulties` column pattern from Phase 5.

### 2. `review_log.source` (new column)

```sql
ALTER TABLE "review_log" ADD COLUMN "source" text;
```

- Nullable. Daily-session rows leave this `NULL` — treating `NULL` as "daily" keeps the daily path unchanged and avoids a backfill. Only Roleta writes a non-null value (`'roleta'`).
- Progress-accuracy queries ignore this column. The column exists so future features (analytics, per-mode dashboards, simulado rollout) can distinguish sources without a schema change.
- Roleta rows additionally write `next_review_at = NULL` so SM-2 scheduling is a no-op for them.

### 3. Migration

Run `drizzle-kit generate --name roleta` to produce a new migration file covering both `ADD COLUMN` statements plus a refreshed snapshot under `packages/db/src/migrations/`. Review the generated SQL before committing.

## Shared schemas (`@pruvi/shared`)

New file `src/roleta.ts`:

```ts
export const roletaConfigSchema = z.object({
  subjects: z.array(z.string()).min(1).max(5),
});
export type RoletaConfig = z.infer<typeof roletaConfigSchema>;

export const roletaConfigResponseSchema = z.object({
  subjects: z.array(z.string()), // resolved — never null; server fills defaults
});

export const roletaStartResponseSchema = z.object({
  spinId: z.string().uuid(),
  subject: subjectSchema,                      // the picked subject for this spin
  questions: z.array(clientQuestionSchema),    // exactly 3 questions from that subject
});

export const roletaAnswerBodySchema = z.object({
  spinId: z.string().uuid(),
  questionId: z.number().int(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});

export const roletaAnswerResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number().int(),
  xpAwarded: z.number().int(),                 // floor(base_xp / 2)
});
```

Re-exported from `packages/shared/src/index.ts`.

## Backend endpoints

New feature module `apps/server/src/features/roleta/`.

| Method | Path | Purpose |
|---|---|---|
| `GET /roleta/config` | Read `roleta_subjects`. If null, return all 5 subject slugs (resolved default). Response shape: `roletaConfigResponseSchema`. |
| `PUT /roleta/config` | Accept `roletaConfigSchema` body. Validate every slug exists in `subject` table (400 on unknown slug). Persist to `user.roleta_subjects`. Return the updated resolved list. |
| `POST /roleta/spin` | Read the user's config (falling back to all 5 slugs). Pick one subject uniformly at random from that list. Select 3 random questions from that subject (`ORDER BY RANDOM() LIMIT 3` — NOT SM-2 priority; Roleta is free-play). Generate a `spinId` (UUID). Return `{spinId, subject, questions}`. No persistence of the spin itself. |
| `POST /roleta/answer` | Validate `spinId` is a UUID (zod). Grade answer. Compute XP using the same per-difficulty base (easy=10, medium=20, hard=35) then floor divide by 2. Write one row to `review_log` with `source='roleta'`, SM-2 fields populated only for the `quality` score (so accuracy stats work), and `next_review_at = NULL`. Award XP to the user. Return `{correct, correctOptionIndex, xpAwarded}`. |

### XP computation detail

Reuse the `xpForCorrect(difficulty)` helper from `reviews.service` — do not duplicate the table. New `halveXp(base)` helper: `Math.floor(base / 2)`. Applied only on the Roleta path. Wrong answers award 0 XP (same as daily).

### Review log write detail

The row looks like:

```ts
{
  userId,
  questionId,
  quality: correct ? 4 : 1,        // matches daily-session SM-2 quality values
  easinessFactor: "2.50",          // identity value; no effect since nextReviewAt is null
  interval: 0,
  repetitions: 0,
  nextReviewAt: null,              // THE flag — null means "do not schedule"
  reviewedAt: new Date(),
  source: "roleta",
}
```

Progress accuracy aggregation continues to work because it counts rows by `(userId, questionId, quality >= 3)` regardless of `nextReviewAt`.

### Cache invalidation

- `PUT /roleta/config` — invalidate `roleta-config:{userId}` (new cache key, 5 min TTL).
- `POST /roleta/answer` — invalidate `xp:{userId}` and `progress:{userId}` (accuracy changed).
- Lives cache untouched (Roleta doesn't touch lives).
- Streaks cache untouched (Roleta doesn't count toward streaks).

## Native wiring

### Services & hooks

- `services/roleta.service.ts` — `getConfig`, `saveConfig(config)`, `spin()`, `answer(body)`. Mirrors `onboarding.service.ts`.
- `hooks/useRoleta.ts` — exports `useRoletaConfig`, `useSaveRoletaConfig`, `useSpinRoleta` (mutation that returns the spin response), `useAnswerRoleta`.

### Store

`stores/roletaStore.ts` — a lean mirror of `sessionStore` for the 3-question mini-set:

```ts
interface RoletaStore {
  currentIndex: number;       // 0..2
  selectedOptionIndex: number | null;
  answerState: "idle" | "correct" | "wrong";
  correctCount: number;
  actions: {
    selectOption: (i: number) => void;
    setAnswerState: (s: AnswerState) => void;
    markCorrect: () => void;
    nextQuestion: () => void;
    reset: () => void;
  };
}
```

### Routes

New group `app/(app)/roleta/`:

- **`index.tsx`** — landing. Shows:
  - Hero card with a large wheel SVG
  - "Configurar" link (→ `configurar`)
  - Primary "GIRAR" CTA. Tapping kicks off `useSpinRoleta().mutateAsync()`; on success, stashes the response in TanStack Query cache (`["roleta", "active-spin", spinId]`), resets `roletaStore`, and navigates to `play?spinId=...`. While pending, CTA shows "GIRANDO..." with the wheel rotating (Reanimated `withRepeat` on a `rotate` transform, ~1.2 s).
- **`play.tsx`** — the 3-question flow. Pulls `active-spin` from cache; renders the questions sequentially using the shared `OptionCard` component (see §Refactor). On each answer, calls `useAnswerRoleta`, animates the result for 1.2 s, advances `currentIndex`. When all 3 answered, replaces route with `result?correct=<n>&total=3&subject=<slug>&xp=<sum>`.
- **`result.tsx`** — light celebratory screen (simpler than daily-session result): subject name, "N de 3 acertos", total XP earned, "GIRAR DE NOVO" (→ `/roleta`, which re-enables the Girar CTA) and "FECHAR" (→ tabs) buttons.
- **`configurar.tsx`** — 5-subject checklist; toggles persist immediately via `useSaveRoletaConfig`. Must enforce min 1 selected (disable the last toggle if it would empty the list).

### Home entry point

Replace the current "Desafios" placeholder tile in the Home screen's "Prática Expressa" section with Roleta:

- Icon: wheel / dice SVG (reuse or lightly adapt `DiceIcon` from legacy `roleta.tsx`).
- Title: "Roleta"
- Subtitle: "3 questões aleatórias"
- onPress → `/roleta`

Flashcards tile stays (will be wired in Phase 6.2).

## Refactor: shared OptionCard

Pull the option-card rendering out of `app/(app)/session/[id].tsx` into `components/session/OptionCard.tsx` so Roleta and daily session share one pixel-perfect card. Props:

```ts
type OptionCardProps = {
  letter: string;
  text: string;
  state: "idle" | "selected" | "correct" | "wrong";
  onPress: () => void;
  disabled?: boolean;
};
```

Both screens pass the same four-state enum; no behavioural change — just extraction. The session screen's `idle` / `selected` / `correct` / `wrong` style branches move into the new component's internal switch.

This is done as part of this spec (not a follow-up) because writing Roleta duplicates the logic otherwise.

## Testing

### Server (unit)

- `RoletaService.getConfig` — returns resolved defaults (all 5 slugs) when the column is null; returns the stored array when set.
- `RoletaService.saveConfig` — rejects unknown slugs (NotFoundError); persists a valid array; returns the echoed list.
- `RoletaService.spin` — picks uniformly from the configured pool; returns exactly 3 questions from the picked subject; returns different questions on successive calls (seeded randomness or shuffle check).
- `RoletaService.answer` — writes a `review_log` row with `source='roleta'` and `nextReviewAt=null`; awards `floor(baseXp / 2)` on correct; awards 0 on wrong; propagates correctness back in the response.

### Server (integration)

- `RoletaRepository` against test DB: insert/read config; `nextReviewAt` is null on a roleta row; `source='roleta'` on a roleta row.
- End-to-end route test: `POST /roleta/spin` → `POST /roleta/answer` ×3 → verify `xp` increased by the sum of per-question awards, `lives` unchanged, `daily_session` row NOT created, `review_log` has 3 rows with `source='roleta'`.

### Native

Manual smoke test (same pattern as other phases). Automated native tests are out of scope for 6.1; they stay a Phase-8 polish task.

## Observability

Minimal. The Fastify logger already captures requests; we'll get free visibility into spin/answer counts via structured logs. No dashboards for Phase 6.1.

## Out of scope

- Wheel animation physics
- Difficulty slider inside Roleta config
- Per-spin streak counter
- Analytics on which subject is most spun
- Sharing spin results outside the app

These are candidates for a Phase 6.1.x polish pass or later.

## Build order

Rough order of commits. Each commit should leave `bun run check-types` and `bun run test` green.

1. Schema + shared Zod + drizzle migration.
2. `RoletaRepository` + `RoletaService` + unit tests.
3. `RoletaRoute` + cache invalidation + integration test.
4. Extract `OptionCard` shared component; refactor `session/[id].tsx` to use it.
5. Native `services/roleta.service.ts` + `hooks/useRoleta.ts` + `stores/roletaStore.ts`.
6. `app/(app)/roleta/` — index, configurar (two simplest first).
7. `app/(app)/roleta/play.tsx` + `result.tsx`.
8. Home tile swap (Desafios → Roleta).
9. Docs: update integration-map to mark 6.1 ✅ and point 6.2 as next.

## Open risks / watch-outs

- `ORDER BY RANDOM()` is fine at 110 seeded questions but scales O(n). Revisit if the question table grows past ~10k rows (use `TABLESAMPLE` or a reservoir sample).
- The `spinId` UUID is not persisted, so we can't later reconstruct a spin from logs. If analytics demand it, a `roleta_spin` table becomes a follow-up migration.
- Cache invalidation on config changes needs to bust BEFORE the next `GET /roleta/config`. Use the `invalidate-before-unwrap` pattern from the reviews route fix in commit `1ab9c30`.
