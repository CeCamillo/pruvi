# Phase 2E.3 — Simulado Semanal (Design Spec)

**Status:** v1
**Date:** 2026-05-12
**Branch:** `feature/phase-2e3-simulado-semanal`
**Product source:** `pruvi-freatures.md` §5.2

---

## 1. Goal

Deliver a weekly mock exam ("simulado") to Ultra users: 35 questions, BRT-anchored Sunday-to-Sunday window, per-subject performance results, and a 5-week history for visualizing progress.

## 2. Non-goals

- Banca-specific question filtering by exam board (`user.selectedExam`). The `question.source` field is unstructured; mapping it to bancas is out of scope for v1. v1 samples from the entire question bank. Banca filtering is deferred.
- Timer enforcement. The client decides whether to show a countdown; the server only records `startedAt`/`completedAt`.
- Coupling the simulado to SM-2 review state, XP, lives, or streak. Simulado is an isolated, monetization-facing flow. Answers do NOT update `review_log` or grant XP.
- Free-tier purchase or trial of individual simulados.
- Real-time multiplayer or proctoring.

## 3. Mechanic

- A new simulado week starts at **Sunday 00:00 BRT** and runs through the following Sunday 00:00 BRT (exclusive).
- One simulado per `(user_id, week_start_date)`. Ultra users can start it any time within the window.
- 35 questions per simulado (configurable constant `SIMULADO_QUESTION_COUNT = 35`, within the product range 30–40).
- Questions are sampled deterministically from the user's perspective: for a given `(userId, weekStart)`, the same 35 questions are always returned. This lets users resume mid-simulado on a different device.
- Answers are stored per-question with server-side `isCorrect`. Answering is idempotent per question (first answer wins; second attempt returns the recorded outcome).
- Lifecycle: `not_started` → `in_progress` (POST /start) → `completed` (POST /complete OR auto-finalized when all 35 questions are answered).
- After completion, results show per-subject correct/total and a 5-week history (current week + 4 prior, oldest first) for charting.

## 4. Entitlement

- Gated by `UltraService.isUltraActive(userId)` (existing, Phase 2E.1).
- Non-Ultra requests return `403 ULTRA_REQUIRED` with the same envelope the lives feature uses for paywalls.
- If Ultra lapses mid-simulado (`ultraExpiresAt` passes while a simulado is in progress), the user can still complete the simulado they started but cannot start a new one. **Rationale:** they paid for that simulado at start time; clawing it back creates support pain.

## 5. Data model

### 5.1 `weekly_simulado`

```sql
CREATE TABLE weekly_simulado (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,                    -- BRT Sunday
  started_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at    TIMESTAMP WITH TIME ZONE,         -- NULL while in_progress
  questions_count INTEGER NOT NULL,                 -- snapshot of SIMULADO_QUESTION_COUNT at start
  correct_count   INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT weekly_simulado_unique UNIQUE (user_id, week_start_date)
);
CREATE INDEX weekly_simulado_user_week_idx
  ON weekly_simulado (user_id, week_start_date DESC);
```

### 5.2 `weekly_simulado_question`

```sql
CREATE TABLE weekly_simulado_question (
  simulado_id            INTEGER NOT NULL REFERENCES weekly_simulado(id) ON DELETE CASCADE,
  position               INTEGER NOT NULL,           -- 0..N-1, stable order
  question_id            INTEGER NOT NULL REFERENCES question(id) ON DELETE RESTRICT,
  selected_option_index  INTEGER,                    -- NULL until answered
  is_correct             BOOLEAN,                    -- NULL until answered
  answered_at            TIMESTAMP WITH TIME ZONE,   -- NULL until answered
  PRIMARY KEY (simulado_id, position),
  CONSTRAINT simulado_question_unique UNIQUE (simulado_id, question_id)
);
CREATE INDEX simulado_question_simulado_idx
  ON weekly_simulado_question (simulado_id);
```

**Note on `ON DELETE RESTRICT` for `question_id`:** prevents losing simulado history when a question is deleted from the bank. If a question must be removed, the admin must first migrate or accept the simulado history is also archived.

## 6. Architecture

New module: `apps/server/src/features/simulados/`

```
simulados/
├── simulados.repository.ts
├── simulados.repository.integration.test.ts
├── simulados.service.ts
├── simulados.service.test.ts
├── simulados.route.ts
└── index.ts
```

### 6.1 Layering

- **Route** parses input, dispatches to service, formats response envelope. Auth via `fastify.authenticate`.
- **Service** orchestrates: checks Ultra entitlement, computes week boundaries via `weekBoundsForSimulado(now)` helper (new, in `packages/shared/src/simulado.ts`), composes question selection + persistence, builds result payloads.
- **Repository** wraps Drizzle calls. All multi-statement writes use `db.transaction`.

### 6.2 Question selection

`SimuladosRepository.selectQuestionsForSimulado(userId, weekStart, count)`:

1. Deterministic seed: `seed = hash(userId || weekStart)` using a stable string hash (e.g., `bun:crypto` SHA-256 → take first 8 bytes as bigint → modulo). The seed itself is not stored; selection is repeatable because the inputs are stable.
2. Query `count` questions from the full bank using `ORDER BY md5(id::text || $seedString) LIMIT $count` to get a deterministic pseudo-random sample without holding the full bank in memory.
3. Return the rows in the resulting order; `position` is the row index.

**Why this approach:** stateless, repeatable, and resumable. Doesn't touch `review_log` and doesn't require pre-storing the questions list before the user starts (we still store the assignment in `weekly_simulado_question` on `/start` so subsequent fetches don't re-query the seed; this also pins the set against future bank edits).

### 6.3 Week boundaries

In `packages/shared/src/simulado.ts`:

```ts
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Sunday-anchored BRT week boundaries. Returns ISO date strings. */
export function weekBoundsForSimulado(now: Date): {
  weekStart: string; // YYYY-MM-DD (Sunday in BRT)
  weekEnd: string;   // YYYY-MM-DD (next Sunday in BRT, exclusive)
} {
  const brtMs = now.getTime() - BRT_OFFSET_MS;
  const brt = new Date(brtMs);
  const dow = brt.getUTCDay(); // 0=Sun..6=Sat
  brt.setUTCDate(brt.getUTCDate() - dow);
  brt.setUTCHours(0, 0, 0, 0);
  const start = new Date(brt);
  const end = new Date(brt);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}
```

**Why a new helper instead of reusing `startOfWeekBrt`:** the existing helper is Monday-anchored (used by ranking). Simulado is Sunday-anchored per product. Different concept, different helper.

### 6.4 Service-level caching

- `GET /simulados/current` payload cached at `simulado:current:{userId}` with TTL 60s.
- Invalidated on: `/start`, `/answer`, `/complete`. (Cheap `cache.del`; safe to call when key doesn't exist.)

### 6.5 Logging

All service errors flow through `fastify.log` (structured), matching the post-2E.2 logger pattern in `sessions.service.ts`. No `console.error`.

## 7. API surface

All routes mount under `/api`; all require `fastify.authenticate`. All responses use the existing `successResponse` envelope.

### 7.1 `GET /simulados/current`

Returns the current week's simulado state and 5-week history (current + 4 prior).

```ts
SimuladoCurrentResponseSchema = z.object({
  weekStart: z.string(),           // YYYY-MM-DD (BRT Sunday)
  weekEnd: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  simulado: z.object({
    id: z.number().int(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
    questionsCount: z.number().int(),
    answeredCount: z.number().int(),
    correctCount: z.number().int(),
  }).nullable(),
  history: z.array(z.object({
    weekStart: z.string(),
    correct: z.number().int(),
    total: z.number().int(),
    perSubject: z.array(z.object({
      subjectId: z.number().int(),
      correct: z.number().int(),
      total: z.number().int(),
    })),
  })),                              // oldest first; up to 5 entries
});
```

Non-Ultra: `403 ULTRA_REQUIRED`.

### 7.2 `POST /simulados/start`

Creates and returns the simulado for the current week. Idempotent: if one already exists for `(user, weekStart)`, returns the existing one.

```ts
// Request body: none
// Response data:
SimuladoStartResponseSchema = z.object({
  simulado: z.object({
    id: z.number().int(),
    startedAt: z.string(),
    questionsCount: z.number().int(),
  }),
  questions: z.array(z.object({
    position: z.number().int(),
    questionId: z.number().int(),
    content: z.string(),
    options: z.array(z.string()),
    subjectId: z.number().int(),
    subtopicId: z.number().int().nullable(),
    requiresCalculation: z.boolean(),
    // selectedOptionIndex/isCorrect/correctOptionIndex/explanation are NOT included here
  })),
});
```

Non-Ultra: `403 ULTRA_REQUIRED`.

### 7.3 `GET /simulados/:id`

Returns the in-progress simulado state (questions + already-recorded answers). For answered questions, includes `selectedOptionIndex` and `isCorrect`; `correctOptionIndex` and `explanation` are only included when the simulado is `completed` OR for the specific answered question (so the client can show post-answer feedback). For unanswered questions, none of the answer fields are included.

**Auth:** must be the simulado owner; otherwise `404`. Use `404` (not `403`) to avoid leaking existence.

### 7.4 `POST /simulados/:id/answer`

```ts
SimuladoAnswerBodySchema = z.object({
  questionId: z.number().int(),
  selectedOptionIndex: z.number().int().min(0).max(3),
});

SimuladoAnswerResponseSchema = z.object({
  isCorrect: z.boolean(),
  correctOptionIndex: z.number().int(),
  explanation: z.string().nullable(),
  answeredCount: z.number().int(),
  completed: z.boolean(),          // true if this answer was the 35th
});
```

**Semantics:**
- Validates the question belongs to this simulado.
- If the question already has a recorded answer: returns the recorded outcome unchanged (idempotent — first answer wins).
- If not answered: records the answer, increments `correct_count` on the parent simulado if correct, and if this was the last unanswered question, sets `completed_at = now()` atomically (single transaction).
- 404 if simulado not found or not owned.
- 400 if `questionId` doesn't belong to this simulado.
- 409 if the simulado is already in state `completed` (no more answers allowed).

### 7.5 `POST /simulados/:id/complete`

Force-finalize a simulado even if not all questions are answered. Sets `completed_at = now()` if NULL. Idempotent. Unanswered questions remain NULL — they count toward `total` but not toward `correct`.

### 7.6 `GET /simulados/:id/results`

Returns the same per-subject breakdown the `current` endpoint embeds in history, but for an arbitrary owned simulado. Only valid when `status = completed`; otherwise `400`.

```ts
SimuladoResultsResponseSchema = z.object({
  weekStart: z.string(),
  correct: z.number().int(),
  total: z.number().int(),
  perSubject: z.array(z.object({
    subjectId: z.number().int(),
    correct: z.number().int(),
    total: z.number().int(),
  })),
  history: z.array(z.object({
    weekStart: z.string(),
    correct: z.number().int(),
    total: z.number().int(),
    perSubject: z.array(z.object({
      subjectId: z.number().int(),
      correct: z.number().int(),
      total: z.number().int(),
    })),
  })),                              // includes the current simulado; oldest first
});
```

## 8. Migration

`packages/db/src/migrations/0009_<name>.sql` (drizzle-kit will generate the suffix):

- Create `weekly_simulado` and `weekly_simulado_question` per §5.
- Add the `(user_id, week_start_date)` UNIQUE constraint inline.
- Add `(simulado_id, question_id)` UNIQUE constraint inline.

No data backfill needed (greenfield tables).

## 9. Testing strategy

**Unit (`*.service.test.ts`)**, using existing PGlite test client pattern:
- Ultra entitlement gating: non-Ultra → 403, Ultra-active → proceeds, Ultra-expired (`ultraExpiresAt` past) → 403 for start, but can still answer/complete an existing simulado.
- `weekBoundsForSimulado` BRT edge cases: Saturday 23:59 BRT, Sunday 00:00 BRT, Sunday 23:59 BRT, week containing DST-style (N/A in BRT but verify no surprise).
- `POST /start` idempotency: second call returns same `simulado.id`.
- `POST /answer` idempotency: re-answering with a different option returns the originally-recorded outcome.
- Auto-completion: answering the 35th question sets `completed_at` and returns `completed: true`.
- `correct_count` increments only on correct, only on first answer for that question.

**Integration (`*.repository.integration.test.ts`)**, real DB via existing helpers:
- `selectQuestionsForSimulado` determinism: same `(userId, weekStart)` returns the same set in the same order.
- `selectQuestionsForSimulado` distinctness: returns `count` distinct questions.
- History query: for a user with 6 prior simulados, returns the most recent 4 + current = 5 entries, ordered oldest first, with correct per-subject breakdown.
- Cascade: deleting a `weekly_simulado` deletes its `weekly_simulado_question` rows (ON DELETE CASCADE).
- UNIQUE constraints reject duplicate `(user, weekStart)` and duplicate `(simulado, question)`.

**Shared (`packages/shared/src/simulado.test.ts`)**:
- `weekBoundsForSimulado` returns Sunday-anchored boundaries for inputs across the BRT week.

## 10. Acceptance criteria

A1. Ultra-active user can `POST /simulados/start` during the current BRT Sunday-Sunday window and receive 35 distinct questions.
A2. The same Ultra user calling `/start` twice in the same week receives the same `simulado.id` and the same question set in the same order.
A3. Non-Ultra user receives `403 ULTRA_REQUIRED` from `/start`, `/current`, `/:id`, `/:id/answer`, `/:id/complete`, `/:id/results`.
A4. `POST /simulados/:id/answer` returns `{ isCorrect, correctOptionIndex, explanation }` based on the stored question and the submitted option.
A5. Answering the same question twice on the same simulado returns the originally-recorded outcome; `correct_count` is incremented exactly once.
A6. Answering the 35th unanswered question auto-completes the simulado (`completed_at` set, response `completed: true`).
A7. `GET /simulados/current` returns `status`, current simulado (or null), and history with up to 5 weeks of per-subject breakdowns ordered oldest first.
A8. `GET /simulados/:id/results` is only available when the simulado is `completed`; otherwise `400`.
A9. A user whose Ultra lapses mid-simulado can still answer and complete the simulado they started, but cannot `/start` a new one.
A10. `weekly_simulado` has a UNIQUE `(user_id, week_start_date)` constraint enforced at the DB layer.
A11. `weekly_simulado_question` has a UNIQUE `(simulado_id, question_id)` constraint enforced at the DB layer.
A12. The `GET /simulados/current` response is cached at `simulado:current:{userId}` with TTL 60s and invalidated on `/start`, `/answer`, `/complete`.
A13. All service errors are logged via `fastify.log` (structured); no `console.error` calls in production paths.

## 11. Deferred items

- Banca-specific question filtering (requires `question.examBoard` field and source→banca mapping).
- Push notification on Sunday morning ("Seu simulado da semana está pronto").
- Comparative analytics ("você melhorou X% em Matemática vs semana passada") — basic data is exposed; aggregation UI is client-side.
- Simulado-specific question quality curation (handcrafted vs sampled).
- Free-tier per-simulado purchase.

## 12. Open questions resolved during design

- **Question count fixed vs. user-chosen:** Fixed at 35 (mid-range). YAGNI: no current UX need for per-user customization.
- **Re-answering policy:** First answer wins. **Why:** matches "real exam" feel and avoids gaming `correct_count`. The product doc doesn't mandate either way.
- **Simulado vs review_log coupling:** Decoupled. **Why:** simulado is monetization-driven and shouldn't double-count for spaced repetition (would distort the SM-2 schedule).
- **XP/streak coupling:** Decoupled. **Why:** simulado is a separate flow; product doesn't request it; coupling would create cross-feature regressions.
- **Question ordering display:** Stored `position` is canonical. Client renders in that order.
