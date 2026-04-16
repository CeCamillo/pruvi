# Phase 2: Service Layer + Hooks + Stores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full data plumbing for the native app — authenticated fetch wrapper, service layer, TanStack Query hooks, and Zustand stores. No UI changes.

**Architecture:** Bottom-up — `lib/api-client.ts` first (foundation), then `services/session.service.ts`, then hooks (which consume services), then stores (independent). Stores are pure UI state; server state lives in TanStack Query.

**Tech Stack:** Better Auth (authClient.$fetch), @tanstack/react-query v5, zustand v5, zod, @pruvi/shared

---

### Task 1: Authenticated fetch wrapper

**Files:**
- Create: `apps/native/lib/api-client.ts`

- [ ] **Step 1: Create the fetch wrapper**

Create `apps/native/lib/api-client.ts`:

```typescript
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

/**
 * Authenticated fetch wrapper around Better Auth's $fetch.
 * Unwraps the server's { success, data } envelope and validates the payload through a Zod schema.
 * Throws on network/auth failure, server error response, or schema mismatch.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  schema: z.ZodType<T>,
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

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "api-client|error TS" | head -20`

Expected: No type errors in `api-client.ts`. The file should be well-typed — `authClient.$fetch` is typed by Better Auth, `z.ZodType<T>` provides the parse type.

- [ ] **Step 3: Commit**

```bash
git add apps/native/lib/api-client.ts
git commit -m "feat(native): add authenticated fetch wrapper with Zod response validation"
```

---

### Task 2: Session service layer

**Files:**
- Create: `apps/native/services/session.service.ts`

- [ ] **Step 1: Create the service file**

Create `apps/native/services/session.service.ts`:

```typescript
import {
  AnswerQuestionResponseSchema,
  LivesResponseSchema,
  StreakResponseSchema,
  XpResponseSchema,
  completeSessionResponseSchema,
  startSessionResponseSchema,
  todaySessionResponseSchema,
} from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

const jsonHeaders = { "Content-Type": "application/json" };

export const sessionService = {
  getToday: () =>
    apiRequest("/sessions/today", { method: "GET" }, todaySessionResponseSchema),

  startSession: (mode: "all" | "theoretical") =>
    apiRequest(
      "/sessions/start",
      {
        method: "POST",
        body: JSON.stringify({ mode }),
        headers: jsonHeaders,
      },
      startSessionResponseSchema,
    ),

  completeSession: (id: number, questionCount: number, correctCount: number) =>
    apiRequest(
      `/sessions/${id}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ questionCount, correctCount }),
        headers: jsonHeaders,
      },
      completeSessionResponseSchema,
    ),

  answerQuestion: (questionId: number, selectedOptionIndex: number) =>
    apiRequest(
      `/questions/${questionId}/answer`,
      {
        method: "POST",
        body: JSON.stringify({ selectedOptionIndex }),
        headers: jsonHeaders,
      },
      AnswerQuestionResponseSchema,
    ),

  getLives: () =>
    apiRequest("/users/me/lives", { method: "GET" }, LivesResponseSchema),

  getXp: () =>
    apiRequest("/users/me/xp", { method: "GET" }, XpResponseSchema),

  getStreaks: () =>
    apiRequest("/streaks", { method: "GET" }, StreakResponseSchema),
};
```

- [ ] **Step 2: Verify imports resolve**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "session.service|error TS" | head -20`

Expected: No errors. All schemas should resolve from `@pruvi/shared` (verified in Phase 0).

- [ ] **Step 3: Commit**

```bash
git add apps/native/services/session.service.ts
git commit -m "feat(native): add session service wrapping all backend endpoints"
```

---

### Task 3: Session query hooks (useSessionQuery.ts)

**Files:**
- Create: `apps/native/hooks/useSessionQuery.ts`

- [ ] **Step 1: Create the hooks file**

Create `apps/native/hooks/useSessionQuery.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useTodaySession() {
  return useQuery({
    queryKey: ["session", "today"],
    queryFn: sessionService.getToday,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: "all" | "theoretical") =>
      sessionService.startSession(mode),
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
    mutationFn: (vars: {
      id: number;
      questionCount: number;
      correctCount: number;
    }) =>
      sessionService.completeSession(
        vars.id,
        vars.questionCount,
        vars.correctCount,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "today"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}
```

- [ ] **Step 2: Verify types**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "useSessionQuery|error TS" | head -20`

Expected: No errors. TanStack Query should infer types from `sessionService` return types.

- [ ] **Step 3: Commit**

```bash
git add apps/native/hooks/useSessionQuery.ts
git commit -m "feat(native): add session lifecycle query and mutation hooks"
```

---

### Task 4: Gamification query hooks (useLives, useXp, useStreaks)

**Files:**
- Create: `apps/native/hooks/useLives.ts`
- Create: `apps/native/hooks/useXp.ts`
- Create: `apps/native/hooks/useStreaks.ts`

- [ ] **Step 1: Create useLives.ts**

Create `apps/native/hooks/useLives.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useLives() {
  return useQuery({
    queryKey: ["lives"],
    queryFn: sessionService.getLives,
    staleTime: 30 * 1000, // 30s — matches server Redis TTL
  });
}
```

- [ ] **Step 2: Create useXp.ts**

Create `apps/native/hooks/useXp.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useXp() {
  return useQuery({
    queryKey: ["xp"],
    queryFn: sessionService.getXp,
    staleTime: 60 * 1000, // 60s — matches server Redis TTL
  });
}
```

- [ ] **Step 3: Create useStreaks.ts**

Create `apps/native/hooks/useStreaks.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useStreaks() {
  return useQuery({
    queryKey: ["streaks"],
    queryFn: sessionService.getStreaks,
    // Inherits 5min default staleTime from QueryClient
  });
}
```

- [ ] **Step 4: Verify types**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "useLives|useXp|useStreaks|error TS" | head -20`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/native/hooks/useLives.ts apps/native/hooks/useXp.ts apps/native/hooks/useStreaks.ts
git commit -m "feat(native): add gamification query hooks (useLives, useXp, useStreaks)"
```

---

### Task 5: Composed profile hook (useProfile)

**Files:**
- Create: `apps/native/hooks/useProfile.ts`

- [ ] **Step 1: Create useProfile.ts**

Create `apps/native/hooks/useProfile.ts`:

```typescript
import { useLives } from "@/hooks/useLives";
import { useStreaks } from "@/hooks/useStreaks";
import { useXp } from "@/hooks/useXp";

/**
 * Composed hook that aggregates XP, streaks, and lives for the profile screen.
 * Returns a flat object instead of nested query results for ergonomic consumption.
 */
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

- [ ] **Step 2: Verify types**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "useProfile|error TS" | head -20`

Expected: No errors. Return type should be inferred with fields: `xp | undefined`, `streaks | undefined`, `lives | undefined`, `isLoading`, `isError`.

- [ ] **Step 3: Commit**

```bash
git add apps/native/hooks/useProfile.ts
git commit -m "feat(native): add useProfile composed hook aggregating XP, streaks, lives"
```

---

### Task 6: Zustand stores (sessionStore, gamificationStore)

**Files:**
- Create: `apps/native/stores/sessionStore.ts`
- Create: `apps/native/stores/gamificationStore.ts`

- [ ] **Step 1: Create sessionStore.ts**

Create `apps/native/stores/sessionStore.ts`:

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
    selectOption: (index) =>
      set({ selectedOptionIndex: index, answerState: "idle" }),
    setAnswerState: (state) => set({ answerState: state }),
    setLivesRemaining: (lives) => set({ livesRemaining: lives }),
    nextQuestion: () =>
      set((s) => ({
        currentQuestionIndex: s.currentQuestionIndex + 1,
        selectedOptionIndex: null,
        answerState: "idle",
      })),
    reset: (initialLives) =>
      set({ ...INITIAL_STATE, livesRemaining: initialLives }),
  },
}));
```

- [ ] **Step 2: Create gamificationStore.ts**

Create `apps/native/stores/gamificationStore.ts`:

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

- [ ] **Step 3: Verify types**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | grep -E "sessionStore|gamificationStore|error TS" | head -20`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/native/stores/sessionStore.ts apps/native/stores/gamificationStore.ts
git commit -m "feat(native): add Zustand stores for session state and gamification signals"
```

---

### Task 7: Full verification

This task has no code changes — it verifies everything built in Phase 2 compiles and integrates cleanly.

- [ ] **Step 1: Full TypeScript check**

Run: `cd apps/native && npx tsc --noEmit 2>&1 | head -40`

Expected: No errors in any new files (`api-client.ts`, `session.service.ts`, all hooks, both stores).

- [ ] **Step 2: Verify file structure**

Run: `cd apps/native && find lib services hooks stores -type f -name "*.ts" | sort`

Expected output:
```
hooks/useLives.ts
hooks/useProfile.ts
hooks/useSessionQuery.ts
hooks/useStreaks.ts
hooks/useXp.ts
lib/api-client.ts
lib/auth-client.ts
services/auth.service.ts
services/session.service.ts
stores/gamificationStore.ts
stores/sessionStore.ts
```

- [ ] **Step 3: Verify no UI changes**

Run: `git diff --stat main...HEAD -- apps/native/app apps/native/components`

Expected: Empty output — nothing in `app/` or `components/` changed.

- [ ] **Step 4: Test import consistency**

Create a throwaway script `apps/native/_test-imports.ts`:

```typescript
import { apiRequest } from "@/lib/api-client";
import { sessionService } from "@/services/session.service";
import { useAnswerQuestion, useCompleteSession, useStartSession, useTodaySession } from "@/hooks/useSessionQuery";
import { useLives } from "@/hooks/useLives";
import { useXp } from "@/hooks/useXp";
import { useStreaks } from "@/hooks/useStreaks";
import { useProfile } from "@/hooks/useProfile";
import { useSessionStore } from "@/stores/sessionStore";
import { useGamificationStore } from "@/stores/gamificationStore";

// Reference them to ensure they're importable (no runtime code)
void apiRequest;
void sessionService;
void useAnswerQuestion;
void useCompleteSession;
void useStartSession;
void useTodaySession;
void useLives;
void useXp;
void useStreaks;
void useProfile;
void useSessionStore;
void useGamificationStore;
```

Run: `cd apps/native && npx tsc --noEmit _test-imports.ts 2>&1 | head -20`

Expected: No errors. Every export is importable.

Delete the test file:

```bash
rm apps/native/_test-imports.ts
```

- [ ] **Step 5: Confirm placeholder screens still render identically**

Run: `git diff main...HEAD -- apps/native/app/\(app\)/`

Expected: Empty output — placeholder screens from Phase 1 untouched.

---

### Summary of all files changed

| Task | File | Change |
|------|------|--------|
| 1 | `apps/native/lib/api-client.ts` | Create |
| 2 | `apps/native/services/session.service.ts` | Create |
| 3 | `apps/native/hooks/useSessionQuery.ts` | Create |
| 4 | `apps/native/hooks/useLives.ts` | Create |
| 4 | `apps/native/hooks/useXp.ts` | Create |
| 4 | `apps/native/hooks/useStreaks.ts` | Create |
| 5 | `apps/native/hooks/useProfile.ts` | Create |
| 6 | `apps/native/stores/sessionStore.ts` | Create |
| 6 | `apps/native/stores/gamificationStore.ts` | Create |

**9 new files. Zero modifications to existing code.**
