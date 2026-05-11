# Phase 2A — Topic System (Design Spec)

**Date:** 2026-05-10
**Phase:** 2A
**Source spec:** `pruvi-freatures.md` §3.2 (Estados de domínio por tópico), §3.3 (Trilha visual), §2 (transições no encerramento da sessão)

## Goal

Introduce a hierarchical topic model (subject → topic → subtopic), per-(user, subtopic) mastery states derived from SM-2 ease-factor averages, an end-of-session mastery-transition surface, and a trilha (tree) API to drive the gamification progression screen. Backend ships with a tiny demo seed; full curated tree is a parallel content-ops deliverable.

## Non-goals

- Frontend trilha rendering (frontend rebuild is in progress).
- Full curated content tree across all 6 subjects (open content-ops track).
- AI-generated trilhas (spec explicitly defers this past MVP).
- Locked/gated subtopics — locking is visual-only; backend always allows sessions on any subtopic.
- Per-answer mid-session transition surfacing — transitions appear only at session complete.

## Data Model

### New tables

```
topic
  id           serial PK
  subject_id   integer NOT NULL REFERENCES subject(id)
  name         text NOT NULL
  slug         text NOT NULL
  display_order integer NOT NULL DEFAULT 0
  created_at   timestamp NOT NULL DEFAULT now()
  UNIQUE (subject_id, slug)
  INDEX (subject_id, display_order)

subtopic
  id           serial PK
  topic_id     integer NOT NULL REFERENCES topic(id)
  name         text NOT NULL
  slug         text NOT NULL
  display_order integer NOT NULL DEFAULT 0
  created_at   timestamp NOT NULL DEFAULT now()
  UNIQUE (topic_id, slug)
  INDEX (topic_id, display_order)
```

### Extensions

```
question
  + subtopic_id integer NOT NULL REFERENCES subtopic(id)
  + INDEX (subtopic_id, difficulty)
  (existing (subject_id, difficulty) index retained — subject filtering still used)

daily_session
  + mastery_snapshot jsonb NULL
    shape: { [subtopicId: number]: MasteryState }
    written at POST /sessions/start, read at POST /sessions/:id/complete
```

### Backfill strategy

The existing 111 questions have no subtopic. Migration creates a fallback "Geral" topic + "Geral" subtopic per existing subject and reassigns the 111 questions to the corresponding leaf:

1. `ALTER TABLE question ADD COLUMN subtopic_id integer NULL`
2. For each row in `subject`: insert a `topic` (slug `geral`, name `Geral`, display_order 0) → insert a `subtopic` under it with the same naming → `UPDATE question SET subtopic_id = <geral_subtopic_for_subject>`
3. `ALTER TABLE question ALTER COLUMN subtopic_id SET NOT NULL`
4. Add FK + index

Content team replaces Geral assignments incrementally as the real tree is curated.

## Mastery Computation

### Inputs

For a `(user_id, subtopic_id)` pair, query `review_log` joined to `question` on `question.subtopic_id = subtopic_id` and filter by the user. Extract:

- `ef_avg` — `avg(easiness_factor)` over those rows
- `review_count` — `count(*)` over those rows

### Function (pure, lives in `@pruvi/shared/mastery.ts`)

```typescript
export const MASTERY_THRESHOLDS = {
  aprendendo: { maxEf: 2.0,  minReviews: 0  },
  entendendo: { maxEf: 2.4,  minReviews: 5  },
  afiado:     { maxEf: 2.8,  minReviews: 8  },
  quase_mestre: { minEf: 2.8, minReviews: 12 },
} as const;

export type MasteryState = "aprendendo" | "entendendo" | "afiado" | "quase_mestre";

export function computeMastery(efAvg: number | null, reviewCount: number): MasteryState {
  if (reviewCount < 5 || efAvg === null) return "aprendendo";
  if (efAvg >= 2.8 && reviewCount >= 12) return "quase_mestre";
  if (efAvg >= 2.4 && reviewCount >= 8)  return "afiado";
  if (efAvg >= 2.0)                      return "entendendo";
  return "aprendendo";
}
```

### Thresholds

| State          | EF range   | Min reviews |
|----------------|------------|-------------|
| Aprendendo     | < 2.0 *or* < 5 reviews | always allowed |
| Entendendo     | 2.0 – 2.39 | ≥ 5  |
| Afiado         | 2.4 – 2.79 | ≥ 8  |
| Quase mestre   | ≥ 2.8      | ≥ 12 |

### Recomputation strategy

Live on read. No materialized `user_subtopic_mastery` table. One SQL roundtrip computes mastery for any set of subtopic_ids:

```sql
SELECT q.subtopic_id,
       avg(rl.easiness_factor) AS ef_avg,
       count(*) AS review_count
FROM review_log rl
JOIN question q ON q.id = rl.question_id
WHERE rl.user_id = $1 AND q.subtopic_id = ANY($2)
GROUP BY q.subtopic_id
```

Subtopics with no review rows are reported as Aprendendo (no row from the query, repository fills with default).

### Caching

| Key                                | TTL    | Invalidated when |
|------------------------------------|--------|------------------|
| `trilha:{userId}:{subjectId}`      | 5 min  | answer in subject |
| `topic:{userId}:{topicId}`         | 5 min  | answer in topic |
| `mastery:{userId}:{subjectId\|all}` | 5 min | any answer        |

`POST /questions/:id/answer` invalidates the user's `mastery:*`, `trilha:*`, `topic:*` keys (same family pattern already used for `progress:*`).

## API Surface

All endpoints require auth and return the standard `{ success: true, data: ... }` envelope.

### `GET /subjects/:subjectId/trilha`

Full nested tree for the trilha screen.

Response:
```json
{
  "subject": { "id": 1, "name": "Biologia", "slug": "biologia" },
  "topics": [
    {
      "id": 5,
      "name": "Citologia",
      "slug": "citologia",
      "displayOrder": 0,
      "subtopics": [
        {
          "id": 17,
          "name": "Membrana plasmática",
          "slug": "membrana-plasmatica",
          "displayOrder": 0,
          "state": "entendendo",
          "efAvg": 2.31,
          "reviewCount": 9
        }
      ]
    }
  ]
}
```

### `GET /topics/:topicId`

Lighter detail when the user drills into a single topic node.

Response:
```json
{
  "topic": { "id": 5, "name": "Citologia", "subjectId": 1, "displayOrder": 0 },
  "subtopics": [
    { "id": 17, "name": "Membrana plasmática", "state": "entendendo", "efAvg": 2.31, "reviewCount": 9, "displayOrder": 0 }
  ]
}
```

### `GET /users/me/mastery?subjectId=`

Flat per-subtopic mastery list. Optional `subjectId` query filter. Drives the spec's "todos os tópicos e seus estados na tela de progresso" view.

Response:
```json
{
  "items": [
    { "subtopicId": 17, "subtopicName": "Membrana plasmática", "topicId": 5, "topicName": "Citologia", "subjectId": 1, "subjectName": "Biologia", "state": "entendendo", "efAvg": 2.31, "reviewCount": 9 }
  ]
}
```

(`subjectName` included so the frontend can render the mastery list without a separate subjects lookup.)

### Extension: `POST /sessions/start`

Body gains optional `topicId` (a subtopic id — naming kept consistent with the frontend convention of "topic" as the user-facing leaf concept):

```json
{ "mode": "all", "topicId": 17 }
```

When `topicId` is set, the question selector filters the pool by `subtopic_id = topicId`. The selected questions' subtopics are collected; mastery is computed for that set and written to `daily_session.mastery_snapshot`. When `topicId` is absent, all subtopics covered by the selected questions are snapshotted.

### Extension: `POST /sessions/:id/complete`

Response gains a `transitions` array:

```json
{
  "transitions": [
    { "subtopicId": 17, "name": "Membrana plasmática", "from": "aprendendo", "to": "entendendo" }
  ]
}
```

Computation:
1. Read `mastery_snapshot` from the row.
2. Recompute current mastery for each subtopic id in the snapshot.
3. Emit one entry per subtopic where current state is strictly higher than snapshot state (state ordering: aprendendo < entendendo < afiado < quase_mestre). **Downward transitions are not surfaced** — spec only celebrates upward progress.
4. Return empty array if no upward transitions.

Idempotent: calling `complete` twice on the same session returns the same transitions because the snapshot is frozen at session start.

## Code Structure

### New feature module

```
apps/server/src/features/topics/
  index.ts                            # topicsRoutes plugin export
  topics.repository.ts                # tree queries, mastery rollup, snapshot helpers
  topics.service.ts                   # getTrilha, getTopicDetail, getUserMastery, snapshotMastery, computeTransitions
  topics.route.ts                     # 3 new routes
  topics.service.test.ts              # unit
  topics.repository.integration.test.ts  # PGlite
```

### Shared package additions

```
packages/shared/src/
  mastery.ts        # MasteryState, computeMastery, MASTERY_THRESHOLDS, masteryStateRank()
  topics.ts         # Zod: SubtopicSchema, TopicSchema, TrilhaResponseSchema, TopicDetailResponseSchema, MasteryListResponseSchema, MasteryTransitionSchema
```

Both re-exported from `packages/shared/src/index.ts`.

### Schema changes

- `packages/db/src/schema/topics.ts` — new (defines `topic`, `subtopic` + relations)
- `packages/db/src/schema/questions.ts` — add `subtopicId` FK + index
- `packages/db/src/schema/daily-sessions.ts` — add `masterySnapshot` jsonb column
- `packages/db/src/schema/index.ts` — re-export topics
- `packages/db/src/test-client.ts` — mirror DDL (per established convention)

### Modified feature modules

- `apps/server/src/features/sessions/sessions.service.ts`
  - `startSession`: accept `topicId`, pass to repository, compute and write snapshot
  - `completeSession`: read snapshot, compute transitions, return in result tuple
- `apps/server/src/features/sessions/sessions.route.ts`
  - Extend Zod request schema (`topicId: z.number().int().positive().optional()`)
  - Extend Zod response schema with `transitions` array
- `apps/server/src/features/sessions/sessions.repository.ts`
  - New `selectQuestionsBySubtopic(subtopicId, limit)` method
  - Existing `selectQuestions` (mode-based) unchanged
- `apps/server/src/features/reviews/reviews.route.ts` (or wherever the answer endpoint lives) — extend cache invalidation to include `mastery:*`, `trilha:*`, `topic:*` for the user

### Migration

`packages/db/src/migrations/0003_<adjective>_<noun>.sql` (drizzle-kit generated, then hand-edited to include the seeding DML):

1. `CREATE TABLE topic`
2. `CREATE TABLE subtopic`
3. `ALTER TABLE question ADD COLUMN subtopic_id integer` (nullable)
4. Seed `Geral` topic + subtopic per existing subject
5. `UPDATE question SET subtopic_id = <Geral_subtopic_id>` matched by subject
6. `ALTER TABLE question ALTER COLUMN subtopic_id SET NOT NULL`
7. `ALTER TABLE question ADD CONSTRAINT FK ... REFERENCES subtopic(id)`
8. `CREATE INDEX question_subtopic_difficulty_idx ON question(subtopic_id, difficulty)`
9. `ALTER TABLE daily_session ADD COLUMN mastery_snapshot jsonb`

### Demo seed

`apps/server/scripts/seed-demo-topics.ts` (one-shot, idempotent):

- Subject "Biologia" → topic "Citologia" → subtopics "Membrana plasmática", "Citoplasma", "Núcleo"
- Reassign ~6 existing Biology questions from the Geral subtopic to these three real subtopics (2 each)
- No-op if the Citologia topic already exists

Documented in the spec; not auto-run by migration. Used by integration tests and dev work. Content team's curated tree replaces it.

## Testing Strategy

### Unit (`topics.service.test.ts`, `mastery.test.ts`)

- `computeMastery` boundary table:
  - reviewCount = 0, 4, 5, 7, 8, 11, 12 (across each EF band)
  - efAvg = null, 1.99, 2.0, 2.39, 2.4, 2.79, 2.8, 3.0
  - Confirm the sample gate forces Aprendendo when reviews < 5 regardless of EF
- `computeTransitions`:
  - All upward jumps (aprendendo→entendendo, entendendo→afiado, afiado→quase_mestre, plus skip-level jumps)
  - Downward changes return empty (no surfacing)
  - Unchanged state returns empty
  - Idempotency: same snapshot + same current produces same output across multiple calls
- `getTrilha` service: structure assembly (topics ordered by displayOrder, subtopics ordered by displayOrder, mastery merged correctly when some subtopics have no review_log rows)

### Integration (`topics.repository.integration.test.ts`)

- Tree query returns nested shape matching the response schema
- Mastery JOIN: insert review_log rows, assert correct ef_avg / review_count per subtopic
- Subtopics with no reviews fall back to Aprendendo
- `topicId` filter on `POST /sessions/start` selects only questions from that subtopic
- `mastery_snapshot` is written at session start and read at complete
- `POST /sessions/:id/complete` returns expected transitions array
- Cache invalidation: after `POST /questions/:id/answer`, `mastery:{userId}:*` and `trilha:{userId}:*` keys are gone

### Manual smoke

- `pnpm verify:migration` succeeds post-migration
- `GET /subjects/1/trilha` with seeded demo user returns the nested Citologia tree
- Complete a session covering a subtopic with enough correct answers to cross a threshold; confirm `transitions` payload

## Caching Invalidation Details

The existing `fastify.cache` plugin wraps Redis. If it doesn't support prefix deletion natively, the implementation maintains a `cache-keys:{userId}` Redis set of currently-live keys for that user, appended on set and used on invalidation. Confirm during implementation; choose the simpler path the plugin supports.

## Open Items (Out of Scope for This Phase)

- Curated tree across all 6 subjects (content-ops track).
- Per-subtopic XP weighting.
- Mastery decay (EF doesn't decay, but a user could stop practicing for weeks and still show "Quase mestre"). Deferred — spec doesn't mention decay.
- "Locked" enforcement (visual-only per Section 1 decision).

## Acceptance Criteria

- 3 new endpoints live, type-safe, integration-tested
- `POST /sessions/start` accepts `topicId` and snapshots mastery
- `POST /sessions/:id/complete` returns upward `transitions`
- Existing 111 questions migrated to Geral subtopics with no data loss
- All unit + integration tests pass
- `pnpm verify:migration` passes
- Demo seed script runs idempotently
- Zero non-test typecheck errors

---

*End of spec.*
