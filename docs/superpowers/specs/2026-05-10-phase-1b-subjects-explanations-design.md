# Phase 1B (code) — Subjects Endpoint & Question Explanations

**Date:** 2026-05-10
**Author:** brainstorming session
**Status:** Draft → pending user review
**Depends on:** Phase 1C (`phase-1c-progress-calendar` branch / PR #12) — stacks cleanly

---

## Context

The audit (`docs/backend-audit-main.md`) identified Phase 1B as content + code. Content curation (400+ new questions, hand-written explanation text for the existing 111) is genuinely an ops track and out of scope for this code phase. This spec covers only the code-side work that unblocks the frontend rebuild's question-feedback UX and any "pick a subject" screen.

Spec 2.3 requires "justificativa em 2–4 linhas, linguagem humana, no tom do personagem" rendered alongside the correct/wrong indicator. The backend currently has no `explanation` column on `question`. The frontend cannot render explanations until this column exists and is surfaced via the answer endpoint.

Spec 1.1 onboarding mentions subject pickers (which subject does the user hate most). The native app currently hardcodes the subject list; a backend-served list is needed for any future content additions to flow without an app rebuild.

---

## Goals

After this phase ships:
- Frontend can fetch the canonical subject list at runtime via `GET /subjects`
- Frontend renders explanations (or a null-fallback) after each answer, served as part of the existing answer response
- Content team can backfill explanations independently — null is a valid state on the wire

---

## Scope

### In scope

1. **`question.explanation` column** — nullable `text` added to schema + migration
2. **Answer response surfaces explanation** — `POST /questions/:id/answer` returns `explanation: string | null`
3. **`GET /subjects` endpoint** — minimal `{ id, slug, name }` list, cached 5 minutes
4. **New `subjects/` feature module** mirroring the existing pattern
5. **Shared schema updates** — `SubjectsListResponseSchema`, extended `AnswerQuestionResponseSchema`

### Explicitly out of scope

- Question bank expansion to 500+ (content ops track)
- Backfill text for existing 111 questions (content ops; frontend renders null fallback)
- Per-subject icon/color/badge tokens (frontend keeps its hardcoded mapping)
- Per-subject question count in `/subjects` response (YAGNI)
- Standalone `GET /questions/:id` endpoint (explanation piggybacks on answer)
- CMS endpoints for content authoring

---

## Schema Changes

### `packages/db/src/schema/questions.ts`

Add one nullable column to the existing `question` table, between `requiresCalculation` and `source`:

```typescript
explanation: text("explanation"),
```

Full block:

```typescript
export const question = pgTable(
  "question",
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOptionIndex: integer("correct_option_index").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
    requiresCalculation: boolean("requires_calculation").notNull().default(false),
    explanation: text("explanation"),
    source: text("source"),
    subjectId: integer("subject_id").notNull().references(() => subject.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("question_subject_difficulty_idx").on(table.subjectId, table.difficulty),
  ],
);
```

### `packages/db/src/test-client.ts`

Update the `CREATE TABLE IF NOT EXISTS "question"` block to include `explanation TEXT,` between `requires_calculation` and `source`.

### `packages/db/src/seed.ts`

No change. `SeedQuestion` interface stays as-is; existing inserts omit the column; Postgres defaults to null. Re-running the seed leaves any future content-team backfill untouched.

### Migration

`drizzle-kit generate` produces a purely additive migration:

```sql
ALTER TABLE "question" ADD COLUMN "explanation" text;
```

Becomes `0002_<name>.sql` alongside `0000_needy_king_bedlam.sql` (Phase 0) and `0001_melted_tigra.sql` (Phase 1A).

---

## API Contracts

### `GET /subjects`

Auth required (consistent with codebase convention).

**Response:**
```typescript
{
  subjects: Array<{
    id: number,
    slug: string,
    name: string,
  }>
}
```

- Sorted by `name` ASC.
- Cached 300s under single shared key `subjects:list` (subjects rarely change; no per-user variance).
- No pagination (bounded list).

### `POST /questions/:questionId/answer` — extended response

Existing endpoint, response gains one field:

```typescript
{
  correct: boolean,
  correctOptionIndex: number,        // 0-3
  livesRemaining: number,
  xpAwarded: number,
  explanation: string | null,        // NEW
}
```

- `explanation` is the raw text from `question.explanation` for the answered question.
- Null when not yet backfilled. Frontend renders a brand-voice fallback.
- No server-side transformation (markdown, character voice formatting are frontend concerns).

### Shared schemas

`packages/shared/src/subjects.ts` adds:

```typescript
export const SubjectsListResponseSchema = z.object({
  subjects: z.array(subjectSchema),
});

export type SubjectsListResponse = z.infer<typeof SubjectsListResponseSchema>;
```

`packages/shared/src/answers.ts` extends `AnswerQuestionResponseSchema`:

```typescript
export const AnswerQuestionResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number().int().min(0).max(3),
  livesRemaining: z.number().int().min(0),
  xpAwarded: z.number().int().min(0),
  explanation: z.string().nullable(),
});
```

---

## Architecture

### New subjects feature module (`apps/server/src/features/subjects/`)

| File | Responsibility |
|---|---|
| `subjects.repository.ts` | `listAll()` — `SELECT id, slug, name FROM subject ORDER BY name ASC` |
| `subjects.service.ts` | Result-wrapped passthrough; no business rules today |
| `subjects.route.ts` | `GET /subjects` with 300s Redis cache |
| `index.ts` | Re-export `subjectsRoutes` |
| `subjects.service.test.ts` | 2 unit tests (returns list; passthrough behavior) |
| `subjects.repository.integration.test.ts` | 1 integration test (seed 2 subjects, assert sorted output) |

### Modified files in reviews feature

- `reviews.repository.ts` — `findQuestionById` already selects via `*`; the new `explanation` column flows through automatically. No code change needed.
- `reviews.service.ts` — extend the success return to include `explanation: q.explanation ?? null`.
- `reviews.service.test.ts` — update mock `question` fixtures to include `explanation: null` (or test text where appropriate); assert it surfaces in the answer result.

### Server wiring

`apps/server/src/index.ts`:
- Import `subjectsRoutes` from `./features/subjects`
- Register `await app.register(subjectsRoutes);` after the other feature routes

### Caching

| Endpoint | Key | TTL | Invalidation |
|---|---|---|---|
| `GET /subjects` | `subjects:list` (single shared key) | 300s | TTL-only — no admin endpoint yet to invalidate from |

---

## Testing

| Layer | What | How |
|---|---|---|
| Unit | `SubjectsService.list` returns subjects from repo | Vitest + mocked repo |
| Unit | `ReviewsService.answerQuestion` surfaces `explanation` in result (null and non-null cases) | Update existing tests; mock question with explanation field |
| Integration | `SubjectsRepository.listAll` returns subjects sorted by name | Vitest + PGlite |

No new integration test for explanation flow — existing `reviews.repository.integration.test.ts` exercises the question read path, and the schema change is purely additive (nullable column).

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Subjects cache invalidation needed when content adds a subject — but there's no admin endpoint yet | 5min TTL handles staleness; revisit when CMS lands |
| Frontend renders null explanation poorly | Frontend concern; suggest fallback "Esta questão ainda não tem comentário." in the rebuild |
| Answer response payload widens by 200-400 bytes per question | Negligible; well under any practical mobile data concern |
| Re-running seed could overwrite future explanation backfill | Seed deliberately omits the column; documented |
| `subject` table has no slug-uniqueness constraint visible in current schema | Not a Phase 1B problem; existing seed uses distinct slugs |

---

## Rollout

**Single PR stacked on `phase-1c-progress-calendar`.** Phase 1B is independent of Phase 1A and Phase 1C; rebases cleanly onto whichever lands first.

### Definition of Done

- [ ] `question.explanation` column added in schema; migration generated
- [ ] `test-client.ts` updated to mirror new DDL
- [ ] `subjects/` feature module created (6 files including tests)
- [ ] `GET /subjects` registered, returns sorted subjects, cached 300s
- [ ] `POST /questions/:id/answer` response includes `explanation` field
- [ ] Shared schemas updated (`SubjectsListResponseSchema`, extended `AnswerQuestionResponseSchema`)
- [ ] All existing unit + integration tests pass
- [ ] 3 new unit tests + 1 new integration test pass
- [ ] `pnpm verify:migration` passes
- [ ] No regression in existing endpoints

---

## Out-of-Band Notes

After Phase 1B (code) lands, the remaining audit gap is **content ops**: 400+ new questions (FUVEST/UNICAMP priority), hand-written explanation text for the existing 111 ENEM placeholders, and topic-level categorization (which becomes meaningful once Phase 2 introduces a `topic` table). None of these block the frontend rebuild — they improve the product quality once it's live.

If a CMS for question authoring becomes a priority, that's a Phase 2+ effort — not a quick add. For now, content team operates via direct SQL or a notebook against the dev DB.

The frontend should render a brand-voice fallback when `explanation` is null. Suggested copy (frontend's call): "Esta questão ainda não tem comentário do personagem."
