# Phase 4: Progress & Subject Endpoints

> Design spec for the native app's Progress, Subject detail, and Profile screens — three authenticated backend endpoints, three Zod schemas, three TanStack Query hooks, three new UI components, and wiring into the three placeholder screens.

## Context

Phases 0-3 are complete. The core loop (Home → Session → Result) works end-to-end against real backend data. Three placeholder tabs + the dynamic Subject detail screen still render filler content.

Phase 2 deferred `progress.service.ts`, `useProgress()`, `useSubjectReviews()` because the endpoints they depend on didn't exist yet. Phase 3 deferred the weekly activity chart, subject breakdown, and calendar. Phase 4 builds all of those consumers and their backend.

## Scope

- Three new authenticated GET endpoints under `apps/server/src/features/progress/`
- Three new Zod schemas + their re-exports in `@pruvi/shared`
- One new native service (`progress.service.ts`) with three query hooks
- Three new native UI components (`SubjectCard`, `ReviewHistoryItem`, `StudyCalendar`)
- Wire the three placeholder screens (`(tabs)/progress.tsx`, `subject/[slug].tsx`, `(tabs)/profile.tsx`)
- Extend mutation invalidations in `useSessionQuery.ts` so answering/completing updates progress-related caches

**Not in scope** (deferred to later phases):
- Achievement/badge list (Phase 5)
- "Trilha" (learning path) UI with unit nodes (Phase 6)
- AI analysis card on Subject detail (Phase 7)
- Detailed explanation cards after answering (Phase 7)
- Character mascot illustrations (Phase 8 polish)

## Design Decisions

1. **Three lean endpoints, not one aggregate.** Matches the Phase 2 `useLives`/`useXp`/`useStreaks` pattern — independent cache keys, independent staleTimes, isolated failure blast radius. The only real tradeoff (3 parallel requests on Progress-tab mount) is mitigated by TanStack Query running them concurrently and each <100ms when cached.

2. **Response shapes locked by the integration map.** The doc already specifies `{ subjects: [...] }`, `{ reviews: [...] }`, `{ dates: [...] }`. This spec formalizes the semantics (ordering, caps, derivation rules, edge cases).

3. **Progress only surfaces attempted subjects.** Subjects with zero `review_log` rows don't appear. Keeps the list relevant; avoids surfacing 40+ empty rows on day one.

4. **`correct` derived from `quality >= 3`.** SM-2 convention. The Phase 0 backend maps `correct → quality=4`, `wrong → quality=1`, so `quality >= 3` is a clean boolean. Wrapped in a shared helper `qualityToCorrect(q: number): boolean` in `@pruvi/shared/sm2.ts` for reuse.

5. **Reviews history capped at 50 rows.** Most-recent-first. No pagination until a user needs more (YAGNI). Cap prevents unbounded list growth for heavy users.

6. **Calendar `month` defaults to current month server-side.** Client passes no param for the common case. Future months rejected with `400 ValidationError`. Past months allowed — no retention limit.

7. **Caching mirrors Phase 2 conventions.** Per-user keys, per-endpoint TTLs, invalidation on writes. Subject-reviews invalidation needs the subject slug for the answered question — new repo helper `getSubjectSlugForQuestion(questionId)`.

8. **No new Zustand store.** Pure server data flows through TanStack Query. Architecture rule: "TanStack Query owns server state."

9. **FlashList + `memo()` everywhere.** Per `native_architecture.md`: `SubjectCard` and `ReviewHistoryItem` are memoized, use stable row keys, render inside FlashList.

10. **Progress feature folder groups all three endpoints.** `apps/server/src/features/progress/` owns `/users/me/progress`, `/subjects/:slug/reviews`, and `/users/me/calendar`. The path doesn't have to match the folder name (precedent: `/users/me/xp` lives in `gamification/`).

## Changes

### 1. Shared Zod Schemas

**`packages/shared/src/progress.ts`** (new)

```ts
import { z } from "zod";

export const subjectProgressSchema = z.object({
  slug: z.string(),
  name: z.string(),
  totalQuestions: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  accuracy: z.number().int().min(0).max(100),
});
export type SubjectProgress = z.infer<typeof subjectProgressSchema>;

export const progressResponseSchema = z.object({
  subjects: z.array(subjectProgressSchema),
});
export type ProgressResponse = z.infer<typeof progressResponseSchema>;
```

**`packages/shared/src/subject-reviews.ts`** (new)

```ts
import { z } from "zod";

export const reviewItemSchema = z.object({
  questionId: z.number().int(),
  body: z.string(),
  correct: z.boolean(),
  reviewedAt: z.string(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const subjectReviewsResponseSchema = z.object({
  reviews: z.array(reviewItemSchema),
});
export type SubjectReviewsResponse = z.infer<typeof subjectReviewsResponseSchema>;
```

**`packages/shared/src/calendar.ts`** (new)

```ts
import { z } from "zod";

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarResponseSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;
```

**`packages/shared/src/sm2.ts`** (modify — add helper)

```ts
export function qualityToCorrect(quality: number): boolean {
  return quality >= 3;
}
```

**`packages/shared/src/index.ts`** (modify — add re-exports)

```ts
export * from "./progress";
export * from "./subject-reviews";
export * from "./calendar";
```

### 2. Backend: `progress` feature folder

**`apps/server/src/features/progress/progress.repository.ts`** (new)

Drizzle-typed queries only. No raw SQL.

```ts
export class ProgressRepository {
  constructor(private db: Db) {}

  async getProgressForUser(userId: string): Promise<SubjectProgressRow[]> {
    // SELECT s.slug, s.name,
    //        COUNT(*)::int AS totalQuestions,
    //        SUM(CASE WHEN r.quality >= 3 THEN 1 ELSE 0 END)::int AS correctCount,
    //        MAX(r.created_at) AS lastActivity
    // FROM review_log r
    // JOIN questions q ON q.id = r.question_id
    // JOIN subjects  s ON s.id = q.subject_id
    // WHERE r.user_id = $1
    // GROUP BY s.slug, s.name
    // ORDER BY lastActivity DESC
  }

  async getSubjectReviews(userId: string, slug: string, limit = 50): Promise<ReviewRow[]> {
    // SELECT r.question_id, q.body, r.quality, r.created_at
    // FROM review_log r
    // JOIN questions q ON q.id = r.question_id
    // JOIN subjects  s ON s.id = q.subject_id
    // WHERE r.user_id = $1 AND s.slug = $2
    // ORDER BY r.created_at DESC
    // LIMIT $3
  }

  async subjectExists(slug: string): Promise<boolean> {
    // SELECT 1 FROM subjects WHERE slug = $1 LIMIT 1
  }

  async getCalendarDates(userId: string, monthStart: Date, monthEnd: Date): Promise<string[]> {
    // SELECT DISTINCT to_char(date, 'YYYY-MM-DD') AS d
    // FROM daily_session
    // WHERE user_id = $1 AND date >= $2 AND date < $3 AND completed_at IS NOT NULL
    // ORDER BY d
  }
}
```

**`apps/server/src/features/questions/questions.repository.ts`** (modify — add helper)

The subject-slug-for-question lookup lives in the questions repo, not progress, since it's about questions metadata (reused by the reviews service for cache invalidation — not a progress-specific concern):

```ts
async getSubjectSlugForQuestion(questionId: number): Promise<string | null> {
  // SELECT s.slug FROM questions q JOIN subjects s ON s.id = q.subject_id WHERE q.id = $1
}
```

**`apps/server/src/features/progress/progress.service.ts`** (new)

Returns `Result<T, AppError>`. Derives `accuracy` + `correct` booleans.

```ts
export class ProgressService {
  constructor(private repo: ProgressRepository) {}

  async getProgress(userId: string): Promise<Result<ProgressResponse, AppError>> {
    const rows = await this.repo.getProgressForUser(userId);
    return ok({
      subjects: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        totalQuestions: r.totalQuestions,
        correctCount: r.correctCount,
        accuracy: r.totalQuestions === 0 ? 0 : Math.round((r.correctCount / r.totalQuestions) * 100),
      })),
    });
  }

  async getSubjectReviews(userId: string, slug: string): Promise<Result<SubjectReviewsResponse, AppError>> {
    if (!(await this.repo.subjectExists(slug))) return err(new NotFoundError("Subject not found"));
    const rows = await this.repo.getSubjectReviews(userId, slug, 50);
    return ok({
      reviews: rows.map((r) => ({
        questionId: r.questionId,
        body: r.body,
        correct: qualityToCorrect(r.quality),
        reviewedAt: r.createdAt.toISOString(),
      })),
    });
  }

  async getCalendar(userId: string, month: string | undefined): Promise<Result<CalendarResponse, AppError>> {
    const target = month ?? formatMonth(new Date());
    if (isFutureMonth(target)) return err(new ValidationError("month cannot be in the future"));
    const { start, end } = monthBoundaries(target);
    const dates = await this.repo.getCalendarDates(userId, start, end);
    return ok({ dates });
  }
}
```

Helpers `formatMonth`, `isFutureMonth`, `monthBoundaries` live in `apps/server/src/features/progress/month-utils.ts` (unit-tested separately).

**`apps/server/src/features/progress/progress.route.ts`** (new)

Three handlers with cache-first reads. Match the existing pattern (lives/xp routes).

```ts
export const progressRoutes: FastifyPluginAsync = async (app) => {
  const repo = new ProgressRepository(app.db);
  const service = new ProgressService(repo);

  app.get("/users/me/progress", { preHandler: app.requireAuth }, async (req) => {
    const userId = req.user.id;
    const cacheKey = `progress:${userId}`;
    const cached = await app.cache.get(cacheKey);
    if (cached) return unwrapResult(ok(JSON.parse(cached)));
    const result = await service.getProgress(userId);
    const response = unwrapResult(result);
    await app.cache.set(cacheKey, JSON.stringify(response.data), 60);
    return response;
  });

  app.get<{ Params: { slug: string } }>(
    "/subjects/:slug/reviews",
    { preHandler: app.requireAuth },
    async (req) => {
      const userId = req.user.id;
      const { slug } = req.params;
      const cacheKey = `subject-reviews:${userId}:${slug}`;
      const cached = await app.cache.get(cacheKey);
      if (cached) return unwrapResult(ok(JSON.parse(cached)));
      const result = await service.getSubjectReviews(userId, slug);
      const response = unwrapResult(result);
      await app.cache.set(cacheKey, JSON.stringify(response.data), 60);
      return response;
    },
  );

  app.get<{ Querystring: CalendarQuery }>(
    "/users/me/calendar",
    {
      preHandler: app.requireAuth,
      schema: { querystring: calendarQuerySchema },
    },
    async (req) => {
      const userId = req.user.id;
      const month = req.query.month;
      const cacheKey = `calendar:${userId}:${month ?? "current"}`;
      const cached = await app.cache.get(cacheKey);
      if (cached) return unwrapResult(ok(JSON.parse(cached)));
      const result = await service.getCalendar(userId, month);
      const response = unwrapResult(result);
      await app.cache.setUntilMidnight(cacheKey, JSON.stringify(response.data));
      return response;
    },
  );
};
```

**`apps/server/src/features/progress/index.ts`** (new)

```ts
export { progressRoutes } from "./progress.route";
```

**`apps/server/src/index.ts`** (modify)

Register alongside existing routes:

```ts
await app.register(progressRoutes);
```

### 3. Cross-feature cache invalidation

**`apps/server/src/features/reviews/reviews.service.ts`** (modify)

After inserting a review (the existing answer flow), invalidate the two progress-related keys:

```ts
await this.repo.insertReview({ ... });
// existing invalidations for lives/xp remain
await cache.del(`progress:${userId}`);
const slug = await questionsRepo.getSubjectSlugForQuestion(questionId);
if (slug) await cache.del(`subject-reviews:${userId}:${slug}`);
```

`reviews.service.ts` already depends on `questionsRepo` for `findQuestionById`, so adding one more method is a pure extension. No new cross-feature coupling introduced.

**`apps/server/src/features/sessions/sessions.service.ts`** (modify)

After `completeSession`, invalidate the calendar for the current month + progress:

```ts
await cache.del(`progress:${userId}`);
const currentMonth = formatMonth(new Date());
await cache.del(`calendar:${userId}:${currentMonth}`);
await cache.del(`calendar:${userId}:current`);
```

(Two keys because clients may call with or without `?month=`. Deleting both covers the common case.)

### 4. Native: service + hooks

**`apps/native/services/progress.service.ts`** (new)

```ts
import {
  calendarResponseSchema,
  progressResponseSchema,
  subjectReviewsResponseSchema,
} from "@pruvi/shared";
import { apiRequest } from "@/lib/api-client";

export const progressService = {
  getProgress: () =>
    apiRequest("/users/me/progress", { method: "GET" }, progressResponseSchema),

  getSubjectReviews: (slug: string) =>
    apiRequest(
      `/subjects/${encodeURIComponent(slug)}/reviews`,
      { method: "GET" },
      subjectReviewsResponseSchema,
    ),

  getCalendar: (month?: string) =>
    apiRequest(
      `/users/me/calendar${month ? `?month=${month}` : ""}`,
      { method: "GET" },
      calendarResponseSchema,
    ),
};
```

**`apps/native/hooks/useProgress.ts`** (new)

```ts
import { useQuery } from "@tanstack/react-query";
import { progressService } from "@/services/progress.service";

export function useProgress() {
  return useQuery({
    queryKey: ["progress"],
    queryFn: progressService.getProgress,
    staleTime: 60 * 1000,
  });
}
```

**`apps/native/hooks/useSubjectReviews.ts`** (new)

```ts
export function useSubjectReviews(slug: string | undefined) {
  return useQuery({
    queryKey: ["subject-reviews", slug],
    queryFn: () => progressService.getSubjectReviews(slug!),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });
}
```

**`apps/native/hooks/useCalendar.ts`** (new)

```ts
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useCalendar(month?: string) {
  const m = month ?? currentMonth();
  return useQuery({
    queryKey: ["calendar", m],
    queryFn: () => progressService.getCalendar(m),
    staleTime: 5 * 60 * 1000,
  });
}
```

**`apps/native/hooks/useSessionQuery.ts`** (modify)

Extend `useAnswerQuestion.onSuccess` and `useCompleteSession.onSuccess`:

```ts
// useAnswerQuestion
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["lives"] });
  queryClient.invalidateQueries({ queryKey: ["xp"] });
  queryClient.invalidateQueries({ queryKey: ["progress"] });
  queryClient.invalidateQueries({ queryKey: ["subject-reviews"] }); // prefix match
},

// useCompleteSession
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["session", "today"] });
  queryClient.invalidateQueries({ queryKey: ["streaks"] });
  queryClient.invalidateQueries({ queryKey: ["xp"] });
  queryClient.invalidateQueries({ queryKey: ["lives"] });
  queryClient.invalidateQueries({ queryKey: ["progress"] });
  queryClient.invalidateQueries({ queryKey: ["calendar"] }); // prefix match
},
```

### 5. Native: 3 new components

**`apps/native/components/subject/SubjectCard.tsx`** — memoized FlashList item.

```tsx
export const SubjectCard = memo(function SubjectCard({
  subject,
  onPress,
}: {
  subject: SubjectProgress;
  onPress: () => void;
}) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(subject.accuracy, { duration: 600 });
  }, [subject.accuracy, width]);
  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <Pressable onPress={onPress} style={cardStyles}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={nameStyle}>{subject.name}</Text>
        <Text style={accuracyStyle}>{subject.accuracy}%</Text>
      </View>
      <View style={trackStyles}>
        <Animated.View style={[fillStyles, barStyle]} />
      </View>
      <Text style={metaStyle}>
        {subject.correctCount}/{subject.totalQuestions} corretas
      </Text>
    </Pressable>
  );
});
```

**`apps/native/components/subject/ReviewHistoryItem.tsx`** — memoized list item.

```tsx
export const ReviewHistoryItem = memo(function ReviewHistoryItem({
  review,
}: {
  review: ReviewItem;
}) {
  return (
    <View style={itemStyles}>
      <View style={badgeStyles(review.correct)}>
        <Ionicons
          name={review.correct ? "checkmark" : "close"}
          size={14}
          color="#FFFFFF"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={bodyStyle}>
          {review.body}
        </Text>
        <Text style={timeStyle}>{formatRelativeTime(review.reviewedAt)}</Text>
      </View>
    </View>
  );
});
```

`formatRelativeTime` helper in `apps/native/lib/date-format.ts` (PT-BR: "há 2h", "ontem", "há 3 dias").

**`apps/native/components/gamification/StudyCalendar.tsx`** — monthly grid.

```tsx
export function StudyCalendar({ dates, month }: { dates: string[]; month: string }) {
  const cells = useMemo(() => buildMonthGrid(month, new Set(dates)), [month, dates]);
  return (
    <View style={gridStyles}>
      {WEEKDAYS_PT.map((d) => (
        <Text key={d} style={weekdayStyle}>
          {d}
        </Text>
      ))}
      {cells.map((cell, i) => (
        <View
          key={i}
          style={[
            cellStyle,
            cell.studied && studiedStyle,
            cell.isToday && todayStyle,
          ]}
        >
          <Text style={cell.inMonth ? dateStyle : dateOutsideStyle}>
            {cell.day || ""}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

`buildMonthGrid(month, studiedSet)` returns a 7×6 array (42 cells) with `{ day, inMonth, isToday, studied }`. Pure function, unit-tested separately.

### 6. Native: screen wiring

**`apps/native/app/(app)/(tabs)/progress.tsx`** (modify)

```tsx
export default function ProgressScreen() {
  const { data, isLoading, isError, refetch } = useProgress();
  const router = useRouter();

  if (isLoading) return <Screen><Skeleton width="100%" height={120} /></Screen>;
  if (isError) return <ErrorState onRetry={refetch} />;

  const subjects = data?.subjects ?? [];

  return (
    <Screen scrollable={false}>
      <Text style={titleStyle}>Seu progresso</Text>
      <FlashList
        data={subjects}
        estimatedItemSize={96}
        keyExtractor={(s) => s.slug}
        renderItem={({ item }) => (
          <SubjectCard
            subject={item}
            onPress={() => router.push(`/subject/${item.slug}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState text="Complete uma sessão para ver seu progresso." />
        }
      />
    </Screen>
  );
}
```

**`apps/native/app/(app)/subject/[slug].tsx`** (modify)

```tsx
export default function SubjectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const progress = useProgress();
  const reviews = useSubjectReviews(slug);

  const subject = progress.data?.subjects.find((s) => s.slug === slug);

  if (reviews.isLoading || progress.isLoading) {
    return <Screen><Skeleton width="100%" height={80} /></Screen>;
  }
  if (reviews.isError || !subject) {
    return <NotFoundState />;
  }

  return (
    <Screen scrollable={false}>
      <Stack.Screen options={{ title: subject.name, headerBackTitle: "Voltar" }} />
      <SubjectHeader subject={subject} />
      <FlashList
        data={reviews.data?.reviews ?? []}
        estimatedItemSize={72}
        keyExtractor={(r, i) => `${r.questionId}-${i}`}
        renderItem={({ item }) => <ReviewHistoryItem review={item} />}
        ListEmptyComponent={
          <EmptyState text="Você ainda não respondeu questões desta matéria." />
        }
      />
    </Screen>
  );
}
```

`SubjectHeader` is a local component inside `subject/[slug].tsx` (name + accuracy badge + totalQuestions count).

**`apps/native/app/(app)/(tabs)/profile.tsx`** (modify)

```tsx
export default function ProfileScreen() {
  const profile = useProfile();
  const calendar = useCalendar();
  const { data: session } = authClient.useSession();

  const currentMonthLabel = formatMonthLabelPt(new Date()); // "Abril 2026"

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 16, paddingTop: 24 }}>
        <CharacterAvatar expression="happy" size={80} />
        <Text style={nameStyle}>{session?.user?.name ?? "Estudante"}</Text>
        <StreakBadge count={profile.streaks?.currentStreak ?? 0} />
      </View>

      {profile.xp && <XpCard xp={profile.xp} />}

      <Text style={sectionTitleStyle}>{currentMonthLabel}</Text>
      {calendar.isLoading ? (
        <Skeleton width="100%" height={280} />
      ) : (
        <StudyCalendar dates={calendar.data?.dates ?? []} month={currentMonth()} />
      )}

      <Button variant="ghost" onPress={() => authService.logout()}>
        <Button.Label>Sair</Button.Label>
      </Button>
    </Screen>
  );
}
```

`XpCard` is a local component (or reuse the Phase 3 home-screen XP card — extract to `components/gamification/XpCard.tsx` during wiring).

`ErrorState`, `EmptyState`, `NotFoundState` are small local components in `apps/native/components/common/` (new, minimal — one `<Text>` + optional retry `<Button>`).

## Error Handling

| Failure | Surface |
|---------|---------|
| Network error on any endpoint | `isError` on the hook → `<ErrorState onRetry={refetch} />` |
| Subject slug not found (404) | `isError` + `NotFoundError` → `<NotFoundState />` with "Matéria não encontrada" |
| Invalid `month` param (400) | `isError` → `<ErrorState>` with generic "Não foi possível carregar". Shouldn't happen in normal flow. |
| Empty lists (0 rows) | `<EmptyState>` with PT-BR copy specific to the context |
| Cache miss → DB timeout | Fastify's default 30s request timeout; client's staleTime + retry (2 attempts per Phase 1 default) handle transient failures |

## Testing

**Backend unit tests** (Vitest, no DB):
- `progress.service.test.ts` — accuracy derivation (edge: zero questions → 0%, 100 of 100 → 100%), `correct` mapping (quality boundary at 3), future-month rejection
- `month-utils.test.ts` — `formatMonth`, `monthBoundaries`, `isFutureMonth` (leap years, month rollover)

**Backend repository integration tests** (Vitest + `setupTestDb`):
- `progress.repository.integration.test.ts` — seed reviews across 2 users × 3 subjects, assert correct aggregation and ordering; assert subject-slug filter; assert `getSubjectSlugForQuestion`
- `calendar` integration — seed 5 completed sessions + 2 incomplete, assert only completed surface; assert month boundary filters

**Native tests:** none for Phase 4 (hook tests require MSW which isn't installed; deferred to a dedicated testing-foundation phase). Manual smoke test against live dev server in iOS simulator is the acceptance gate.

## Exit Criteria

1. `bun run test` (server) passes, including new unit + integration tests.
2. `cd apps/native && npx tsc --noEmit` clean on Phase 4 files (pre-existing `_legacy/` errors unaffected).
3. All 3 endpoints callable via `curl` with a valid session cookie; responses parse through their shared Zod schemas.
4. Progress tab: FlashList renders ≥1 `SubjectCard` after completing one session. Accuracy bar animates on mount.
5. Subject detail: renders subject name + accuracy header, FlashList of `ReviewHistoryItem` with correct/wrong badges.
6. Profile tab: `StudyCalendar` shows current month, today highlighted, past completed days filled with `colors.primary`.
7. Mutation invalidation verified: answering a question refetches `["progress"]`; completing a session refetches `["calendar"]` + `["progress"]`.
8. Zero new TS errors in Phase 4 files; zero new Metro bundler errors.

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/progress.ts` | New |
| `packages/shared/src/subject-reviews.ts` | New |
| `packages/shared/src/calendar.ts` | New |
| `packages/shared/src/sm2.ts` | Add `qualityToCorrect` helper |
| `packages/shared/src/index.ts` | Re-export 3 new modules |
| `apps/server/src/features/progress/progress.route.ts` | New |
| `apps/server/src/features/progress/progress.service.ts` | New |
| `apps/server/src/features/progress/progress.repository.ts` | New |
| `apps/server/src/features/progress/month-utils.ts` | New |
| `apps/server/src/features/progress/index.ts` | New |
| `apps/server/src/features/progress/*.test.ts` | New (3 test files) |
| `apps/server/src/index.ts` | Register `progressRoutes` |
| `apps/server/src/features/questions/questions.repository.ts` | Add `getSubjectSlugForQuestion` helper |
| `apps/server/src/features/reviews/reviews.service.ts` | Add progress + subject-reviews invalidation |
| `apps/server/src/features/sessions/sessions.service.ts` | Add calendar + progress invalidation |
| `apps/native/services/progress.service.ts` | New |
| `apps/native/hooks/useProgress.ts` | New |
| `apps/native/hooks/useSubjectReviews.ts` | New |
| `apps/native/hooks/useCalendar.ts` | New |
| `apps/native/hooks/useSessionQuery.ts` | Extend mutation invalidations |
| `apps/native/components/subject/SubjectCard.tsx` | New |
| `apps/native/components/subject/ReviewHistoryItem.tsx` | New |
| `apps/native/components/gamification/StudyCalendar.tsx` | New |
| `apps/native/components/gamification/XpCard.tsx` | New (extracted from home) |
| `apps/native/components/common/{ErrorState,EmptyState,NotFoundState}.tsx` | New (3 tiny files) |
| `apps/native/lib/date-format.ts` | New (relative + month label helpers) |
| `apps/native/app/(app)/(tabs)/progress.tsx` | Wire |
| `apps/native/app/(app)/subject/[slug].tsx` | Wire |
| `apps/native/app/(app)/(tabs)/profile.tsx` | Wire |

**~23 new files, 10 modifications.**
