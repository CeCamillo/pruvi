# Phase 2: Service Layer + Hooks + Stores

> Design spec for the native app's data plumbing — services, TanStack Query hooks, and Zustand stores. No UI changes.

## Context

Phases 0-1 are complete (PRs #2, #3). The native app has:
- Target navigation structure: `(auth)/` + `(app)/(tabs)/` + `session/` + `subject/`
- Auth guard using Better Auth `useSession()` + loading spinner + redirect
- `QueryClientProvider` with defaults (staleTime 5min, retry 2)
- Common components: `Screen`, `Skeleton`
- Existing `services/auth.service.ts` establishing the service pattern
- All Zod schemas available from `@pruvi/shared`

Phase 2 builds the full data plumbing. Every backend endpoint gets a typed service function, a Query/Mutation hook, and ephemeral stores are in place. No screens are wired — that's Phase 3.

## Scope

- Build `lib/api-client.ts` — authenticated fetch wrapper using `authClient.$fetch`
- Build `services/session.service.ts` — 7 functions for all existing backend endpoints
- Build 5 TanStack Query hook files
- Build 2 Zustand stores (`sessionStore`, `gamificationStore`)
- NOT touching: backend, `@pruvi/shared`, UI screens
- Deferred to Phase 4: `services/progress.service.ts`, `useProgress()`, `useSubjectReviews()` (depend on backend endpoints that don't exist yet)

## Design Decisions

1. **Authenticated fetch:** Use `authClient.$fetch(path, options)`. Better Auth's Expo plugin already manages session tokens via SecureStore. No custom token handling needed.
2. **Response unwrapping:** Server wraps responses in `{ success, data }`. The `apiRequest()` helper unwraps this envelope and parses through Zod schemas (runtime type safety).
3. **Error handling:** Services throw on failure. TanStack Query's native `error` state handles errors in components. Matches the existing `login.tsx` pattern.
4. **Zustand structure:** Two separate stores per architecture doc — different lifecycles (session resets on screen unmount, gamification flushes after animations).
5. **Progress deferred:** `progress.service.ts`, `useProgress()`, `useSubjectReviews()` deferred to Phase 4 when backend endpoints `/users/me/progress` and `/subjects/:slug/reviews` are built.
6. **Zustand actions nested:** `actions` key separate from state fields. Lets components select either state or actions without unnecessary re-renders (Zustand v5 best practice).

## Changes

### 1. `lib/api-client.ts` — Authenticated Fetch Wrapper

```typescript
import { authClient } from "@/lib/auth-client";
import { z } from "zod";

export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  schema: z.ZodType<T>
): Promise<T> {
  const response = await authClient.$fetch(path, options);

  // Better Auth layer: network or auth failure
  if (response.error) {
    throw new Error(response.error.message ?? "Request failed");
  }

  // Server layer: { success: false, error, code }
  const payload = response.data as {
    success: boolean;
    data: unknown;
    error?: string;
    code?: string;
  };
  if (!payload.success) {
    throw new Error(payload.error ?? "Request failed");
  }

  // Parse + validate — throws on shape mismatch
  return schema.parse(payload.data);
}
```

### 2. `services/session.service.ts` — 7 Endpoint Functions

```typescript
import {
  startSessionResponseSchema,
  todaySessionResponseSchema,
  completeSessionResponseSchema,
  AnswerQuestionResponseSchema,
  StreakResponseSchema,
  LivesResponseSchema,
  XpResponseSchema,
} from "@pruvi/shared";
import { apiRequest } from "@/lib/api-client";

const jsonHeaders = { "Content-Type": "application/json" };

export const sessionService = {
  getToday: () =>
    apiRequest("/sessions/today", { method: "GET" }, todaySessionResponseSchema),

  startSession: (mode: "all" | "theoretical") =>
    apiRequest(
      "/sessions/start",
      { method: "POST", body: JSON.stringify({ mode }), headers: jsonHeaders },
      startSessionResponseSchema
    ),

  completeSession: (id: number, questionCount: number, correctCount: number) =>
    apiRequest(
      `/sessions/${id}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ questionCount, correctCount }),
        headers: jsonHeaders,
      },
      completeSessionResponseSchema
    ),

  answerQuestion: (questionId: number, selectedOptionIndex: number) =>
    apiRequest(
      `/questions/${questionId}/answer`,
      {
        method: "POST",
        body: JSON.stringify({ selectedOptionIndex }),
        headers: jsonHeaders,
      },
      AnswerQuestionResponseSchema
    ),

  getLives: () =>
    apiRequest("/users/me/lives", { method: "GET" }, LivesResponseSchema),

  getXp: () =>
    apiRequest("/users/me/xp", { method: "GET" }, XpResponseSchema),

  getStreaks: () =>
    apiRequest("/streaks", { method: "GET" }, StreakResponseSchema),
};
```

### 3. TanStack Query Hooks

**`hooks/useSessionQuery.ts`** — 1 query + 3 mutations:

```typescript
export function useTodaySession() {
  return useQuery({
    queryKey: ["session", "today"],
    queryFn: sessionService.getToday,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: "all" | "theoretical") => sessionService.startSession(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "today"] });
    },
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: number; selectedOptionIndex: number }) =>
      sessionService.answerQuestion(vars.questionId, vars.selectedOptionIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; questionCount: number; correctCount: number }) =>
      sessionService.completeSession(vars.id, vars.questionCount, vars.correctCount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "today"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}
```

**`hooks/useLives.ts`** — 30s staleTime (matches server Redis TTL):

```typescript
export function useLives() {
  return useQuery({
    queryKey: ["lives"],
    queryFn: sessionService.getLives,
    staleTime: 30 * 1000,
  });
}
```

**`hooks/useXp.ts`** — 60s staleTime (matches server Redis TTL):

```typescript
export function useXp() {
  return useQuery({
    queryKey: ["xp"],
    queryFn: sessionService.getXp,
    staleTime: 60 * 1000,
  });
}
```

**`hooks/useStreaks.ts`** — inherits 5min default staleTime:

```typescript
export function useStreaks() {
  return useQuery({
    queryKey: ["streaks"],
    queryFn: sessionService.getStreaks,
  });
}
```

**`hooks/useProfile.ts`** — composed hook returning flat object:

```typescript
export function useProfile() {
  const xp = useXp();
  const streaks = useStreaks();
  const lives = useLives();

  return {
    xp: xp.data,
    streaks: streaks.data,
    lives: lives.data,
    isLoading: xp.isLoading || streaks.isLoading || lives.isLoading,
    isError: xp.isError || streaks.isError || lives.isError,
  };
}
```

### 4. Zustand Stores

**`stores/sessionStore.ts`** — Q&A loop state:

```typescript
import { create } from "zustand";

type AnswerState = "idle" | "correct" | "wrong";

interface SessionStore {
  currentQuestionIndex: number;
  selectedOptionIndex: number | null;
  answerState: AnswerState;
  livesRemaining: number;
  actions: {
    selectOption: (index: number) => void;
    setAnswerState: (state: AnswerState) => void;
    setLivesRemaining: (lives: number) => void;
    nextQuestion: () => void;
    reset: (initialLives: number) => void;
  };
}

const INITIAL_STATE = {
  currentQuestionIndex: 0,
  selectedOptionIndex: null,
  answerState: "idle" as const,
  livesRemaining: 5,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...INITIAL_STATE,
  actions: {
    selectOption: (index) => set({ selectedOptionIndex: index, answerState: "idle" }),
    setAnswerState: (state) => set({ answerState: state }),
    setLivesRemaining: (lives) => set({ livesRemaining: lives }),
    nextQuestion: () =>
      set((s) => ({
        currentQuestionIndex: s.currentQuestionIndex + 1,
        selectedOptionIndex: null,
        answerState: "idle",
      })),
    reset: (initialLives) => set({ ...INITIAL_STATE, livesRemaining: initialLives }),
  },
}));
```

**`stores/gamificationStore.ts`** — XP accumulator + animation signals:

```typescript
import { create } from "zustand";

interface GamificationStore {
  pendingXP: number;
  streakAnimationTrigger: number;
  actions: {
    addXP: (amount: number) => void;
    triggerStreakAnimation: () => void;
    flush: () => void;
  };
}

export const useGamificationStore = create<GamificationStore>((set) => ({
  pendingXP: 0,
  streakAnimationTrigger: 0,
  actions: {
    addXP: (amount) => set((s) => ({ pendingXP: s.pendingXP + amount })),
    triggerStreakAnimation: () =>
      set((s) => ({ streakAnimationTrigger: s.streakAnimationTrigger + 1 })),
    flush: () => set({ pendingXP: 0, streakAnimationTrigger: 0 }),
  },
}));
```

**Notable design choices:**
- `selectedOptionIndex: number | null` (not `string`) — backend uses numeric indices (0-3), avoiding conversion bugs
- `streakAnimationTrigger: number` (not `boolean`) — incrementing counter is robust to rapid-fire triggers
- `reset(initialLives)` takes lives count — store reads current lives from `useLives()` (server state) on mount, doesn't fetch its own data
- Actions nested under `actions` key — components select state or actions separately to minimize re-renders

## Exit Criteria

1. `npx tsc --noEmit` passes from `apps/native/`
2. All hooks importable and typed correctly
3. All services return unwrapped + validated data
4. `useProfile()` composes the three dependent hooks
5. Query keys consistent between queries and mutation invalidations
6. Zustand stores follow the nested `actions` pattern
7. Zero UI changes — Phase 1 placeholder screens render identically

## Files Changed

| File | Change |
|------|--------|
| `apps/native/lib/api-client.ts` | New — authenticated fetch wrapper |
| `apps/native/services/session.service.ts` | New — 7 endpoint functions |
| `apps/native/hooks/useSessionQuery.ts` | New — 4 hooks (1 query + 3 mutations) |
| `apps/native/hooks/useLives.ts` | New |
| `apps/native/hooks/useXp.ts` | New |
| `apps/native/hooks/useStreaks.ts` | New |
| `apps/native/hooks/useProfile.ts` | New — composed hook |
| `apps/native/stores/sessionStore.ts` | New — Q&A state |
| `apps/native/stores/gamificationStore.ts` | New — XP + animation signals |

**9 new files. No modifications to existing files.**
