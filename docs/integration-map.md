# Pruvi Integration Map

> Last updated: 2026-04-11
>
> This document maps every integration between `apps/native` and `apps/server`. All frontend work follows `apps/native/native_architecture.md` — that document is the single source of truth for how the native app is built.
>
> **Current status:** Phases 0-1 complete. Phase 2 is next.

---

## Part 1 — What the Backend Does Today

The server (`apps/server`) implements a **spaced-repetition study engine** with gamification. Here is every endpoint currently available:

### Auth (Better Auth — delegated)

| Method | Path | What it does |
|--------|------|-------------|
| `POST` | `/api/auth/sign-up/email` | Register with name + email + password |
| `POST` | `/api/auth/sign-in/email` | Login with email + password |
| `GET` | `/api/auth/get-session` | Validate current session token |
| `*` | `/api/auth/*` | Catch-all for Better Auth (logout, etc.) |

**Cookie config:** HttpOnly, Secure, SameSite=None. Expo plugin stores tokens via `expo-secure-store`.

### Study Sessions

| Method | Path | Auth | What it does |
|--------|------|------|-------------|
| `POST` | `/sessions/start` | Yes | Start or resume today's session. Returns session + 10 SM-2 prioritized questions (strips `correctOptionIndex` before sending). Checks Redis prefetch cache first. |
| `GET` | `/sessions/today` | Yes | Get today's session if it exists (active or completed). Cached 30s in Redis. |
| `POST` | `/sessions/:id/complete` | Yes | Mark session complete with `{ questionCount, correctCount }`. Invalidates streak/session cache. Enqueues next-session prefetch job. |

### Question Answering

| Method | Path | Auth | What it does |
|--------|------|------|-------------|
| `POST` | `/questions/:questionId/answer` | Yes | Submit answer `{ selectedOptionIndex: 0-3 }`. Checks correctness, runs SM-2 algorithm, appends to `review_log`, awards XP on correct, decrements lives on wrong. Returns `{ correct, correctOptionIndex, livesRemaining, xpAwarded }`. |

### Gamification

| Method | Path | Auth | What it does |
|--------|------|------|-------------|
| `GET` | `/users/me/lives` | Yes | Current lives (0-5), auto-refills if 24h timer expired. Cached 30s. |
| `GET` | `/users/me/xp` | Yes | Total XP, current level (1-11), XP to next level. Cached 60s. |
| `GET` | `/streaks` | Yes | Current streak, longest streak, total sessions. Cached until midnight. |

### Infrastructure

| Method | Path | Auth | What it does |
|--------|------|------|-------------|
| `GET` | `/health` | No | DB connectivity check |

### Background Workers

| Worker | Queue | What it does |
|--------|-------|-------------|
| `session-prefetch` | BullMQ via Redis | After session completion, pre-generates 10 SM-2 questions for next session. Cached 1h in Redis. Concurrency: 5, retries: 3 with exponential backoff. |

### Caching (Redis, optional — degrades gracefully)

| Key Pattern | TTL | Invalidated by |
|-------------|-----|----------------|
| `session-today:{userId}` | 30s | `sessions/start`, `sessions/:id/complete` |
| `lives:{userId}` | 30s | `questions/:id/answer` |
| `xp:{userId}` | 60s | `questions/:id/answer` |
| `streaks:{userId}` | Until midnight | `sessions/:id/complete` |
| `prefetch:{userId}` | 1h | `sessions/start` |

### Database Schema (what exists in PostgreSQL)

**Auth tables** (managed by Better Auth):
- `user` — id, name, email, emailVerified, image, **lives** (default 5), **livesResetAt**, **totalXp** (default 0), **currentLevel** (default 1)
- `session` — token-based session management
- `account` — multi-provider support (currently email/password only)
- `verification` — email verification tokens

**Domain tables:**
- `subject` — id, name, slug (seeded with: Matemática, Biologia, Física, Química, Português)
- `question` — id, body, options (jsonb), correctOptionIndex, difficulty (1-5), requiresCalculation, source, subjectId
- `daily_session` — id, userId, date, questionsAnswered, questionsCorrect, completedAt
- `review_log` — append-only SM-2 history: quality, easinessFactor, interval, repetitions, nextReviewAt, reviewedAt (indexed for fast SM-2 lookups)

### Feature Interaction Map

```
User answers question
  ├── Correct → XP awarded (easy:10, medium:20, hard:35), SM-2 quality=4
  └── Wrong   → Life lost (-1), SM-2 quality=1
                  └── First wrong (5→4): starts 24h refill timer
                  └── If lives=0: error 400 "No lives remaining"

Session completed
  ├── Streak cache invalidated (recalculated on next GET)
  └── Prefetch job queued → worker pre-generates next 10 questions
```

---

## Part 2 — Current Frontend vs Target Architecture

### What exists today

The native app (`apps/native`) has a pixel-perfect UI with **100% mock data** beyond auth. There is no data fetching library, no service layer, no state management — just screens with hardcoded arrays.

**Current navigation:**
```
app/
├── _layout.tsx                     ← Root with (onboarding) initial route
├── (onboarding)/                   ← 10+ screens: start, exam-select, prep-questions, etc.
└── (drawer)/                       ← Flat list of 20+ screens with mock data
    ├── index.tsx                   ← Home (hardcoded stats)
    ├── trilha.tsx                  ← Learning trail (mock)
    ├── roleta.tsx                  ← Roulette (mock)
    ├── roleta-quiz.tsx             ← Quiz with MOCK_QUESTIONS
    ├── amigos.tsx                  ← Friends (mock)
    ├── profile.tsx                 ← Profile (mock)
    ├── progresso.tsx               ← Progress (mock)
    ├── flashcards.tsx              ← Flashcards (mock)
    ├── simulados.tsx               ← Mock tests (mock)
    └── ... 10+ more screens
```

**Current dependencies that need changing:**
- `@tanstack/react-form` → replace with `react-hook-form` + zod resolver
- No `@tanstack/react-query` → install v5
- No `zustand` → install v5
- No `@shopify/flash-list` → install v1

### What the architecture defines (target state)

From `native_architecture.md`, the target is a focused app with 5 core screens, a clean service layer, and strict state separation:

**Target navigation:**
```
app/
├── _layout.tsx                     ← Auth guard + QueryClientProvider + theme
├── (auth)/
│   ├── _layout.tsx                 ← Unauthenticated stack
│   ├── login.tsx                   ← Email/password sign in
│   └── register.tsx                ← Email/password sign up
└── (app)/
    ├── _layout.tsx                 ← Drawer (authenticated only)
    ├── (tabs)/
    │   ├── _layout.tsx             ← Bottom tab bar
    │   ├── index.tsx               ← Home / daily session entry
    │   ├── progress.tsx            ← Stats & subject history
    │   └── profile.tsx             ← User profile + settings
    ├── session/
    │   ├── [id].tsx                ← Active session (Q&A loop)
    │   └── result.tsx              ← Session result + XP breakdown
    └── subject/
        └── [slug].tsx              ← Subject detail + review history
```

**Target services:**
```
services/
├── session.service.ts              ← getToday, startSession, answerQuestion, completeSession
├── progress.service.ts             ← getSubjectStats, getReviewHistory
└── auth.service.ts                 ← login, register, logout (wraps Better Auth client)
```

**Target hooks:**
```
hooks/
├── useSessionQuery.ts              ← useTodaySession(), useStartSession(), useAnswerQuestion()
├── useProgress.ts                  ← useProgress()
└── useProfile.ts                   ← useProfile()
```

**Target stores (Zustand — ephemeral only):**
```
stores/
├── sessionStore.ts                 ← currentQuestionIndex, selectedOption, answerState, livesRemaining
└── gamificationStore.ts            ← pendingXP, streakAnimationTrigger
```

**Target components:**
```
components/
├── session/
│   ├── QuestionCard.tsx            ← Question text + 4 OptionButton children
│   ├── OptionButton.tsx            ← Animated: idle → selected → correct/wrong
│   ├── LivesBar.tsx                ← Heart icons, shake on loss
│   └── ProgressBar.tsx             ← Questions answered / total
├── gamification/
│   ├── XPCounter.tsx               ← Animated spring number counter
│   ├── StreakBadge.tsx              ← Flame icon + streak count
│   └── CharacterAvatar.tsx         ← Character with expression states
├── common/
│   ├── Screen.tsx                  ← SafeAreaView + scroll wrapper
│   ├── Button.tsx                  ← Primary/secondary/ghost variants
│   └── Skeleton.tsx                ← Loading placeholder
└── subject/
    └── SubjectCard.tsx             ← FlashList item for subject list
```

### Screen mapping: current → target

| Current screen | Target screen | Data source change |
|---------------|---------------|-------------------|
| `(drawer)/index.tsx` | `(app)/(tabs)/index.tsx` | Hardcoded stats → `useTodaySession()` + `useStreaks()` + `useLives()` |
| `(drawer)/roleta-quiz.tsx` | `(app)/session/[id].tsx` | `MOCK_QUESTIONS` → `useStartSession()` response + `useSessionStore` |
| `(drawer)/roleta-result.tsx` | `(app)/session/result.tsx` | Empty → aggregated answer data + `XPCounter` animation |
| `(drawer)/progresso.tsx` | `(app)/(tabs)/progress.tsx` | Hardcoded achievements → `useProgress()` + `FlashList<SubjectCard>` |
| `(drawer)/profile.tsx` | `(app)/(tabs)/profile.tsx` | Hardcoded stats → `useProfile()` + `CharacterAvatar` |
| `(no equivalent)` | `(app)/subject/[slug].tsx` | New screen — `useProgress()` per subject |
| `(onboarding)/start.tsx` | `(auth)/login.tsx` | Auth client already wired |
| `components/sign-up.tsx` | `(auth)/register.tsx` | Auth client already wired |

**Screens in current codebase NOT in target architecture** (deferred to later phases):
- Onboarding flow: `exam-select`, `prep-questions`, `difficulty-questions`, `daily-time`, `test-question-*`
- Social: `amigos`, `encontre-amigos`, `procurar-amigos`, `contatos-na-pruvi`, `compartilhar-perfil`
- Content: `trilha`, `selecao-trilha`, `flashcards`, `simulados`, `questao-simulado`
- Other: `configurar-roleta`, `premium`, `inserir-telefone`, `inserir-codigo-sms`

---

## Part 3 — Shared Schema Contract (`@pruvi/shared`)

The architecture mandates: **never duplicate schema definitions in the native app. If a schema doesn't exist in `@pruvi/shared`, add it there.**

Both `apps/server` and `apps/native` import from `@pruvi/shared`. These are the schemas both sides need:

### Currently exported (verified)

| Schema | File | Used by |
|--------|------|---------|
| `AnswerQuestionBodySchema` | `questions.ts` | Server route validation, native form |
| `AnswerQuestionResponseSchema` | `questions.ts` | Server response, native service parse |
| `StreakResponseSchema` | `sessions.ts` | Server response, native `useStreaks()` |
| `CompleteSessionBodySchema` | `sessions.ts` | Server route validation, native mutation |
| `XpResponseSchema` | `xp.ts` | Server response, native `useXp()` |
| `LivesResponseSchema` | `lives.ts` | Server response, native `useLives()` |
| `calculateSm2()` | `sm2.ts` | Server review processing |
| `calculateXpForAnswer()` | `xp.ts` | Server XP awarding |
| `getLevelForXp()` | `xp.ts` | Server level computation |

### Missing — must be added before integration

| Schema | Purpose | Used by |
|--------|---------|--------|
| `SessionSchema` | Shape of a daily session object | Server response, native `useTodaySession()` |
| `QuestionSchema` | Shape of a question (without `correctOptionIndex` for client) | Server response, native `QuestionCard` props |
| `StartSessionBodySchema` | `{ mode: "all" \| "theoretical" }` | Server route validation, native `useStartSession()` |
| `StartSessionResponseSchema` | `{ session: Session, questions: Question[] }` | Server response, native `session.service.ts` parse |
| `TodaySessionResponseSchema` | `{ session: Session \| null }` | Server response, native `session.service.ts` parse |
| `CompleteSessionResponseSchema` | `{ session: Session }` | Server response, native `session.service.ts` parse |
| `SubjectSchema` | Shape of a subject object | Server response, native `SubjectCard` props |

### Naming alignment needed

| Field | DB column | Current shared type | Frontend mock | Align to |
|-------|-----------|-------------------|---------------|----------|
| Question text | `body` | `content` (some places) | `text` | Pick one, update everywhere |
| Difficulty | `integer (1-5)` | `number` | N/A | Map to `"easy" \| "medium" \| "hard"` at the shared schema level |

---

## Part 4 — Backend Blockers

Before integration work begins, the server has issues that will block the frontend:

### 🔴 Critical (will cause runtime errors)

| Issue | Location | Problem |
|-------|----------|---------|
| Missing shared schemas | `@pruvi/shared` | `StartSessionBodySchema`, `SessionSchema`, `QuestionSchema` are imported by server routes but **not exported** from the shared package. Server may fail to compile or crash at runtime. |
| SM-2 signature mismatch | `@pruvi/shared/sm2.ts` ↔ `features/reviews/reviews.service.ts` | Service calls `calculateSM2(state, quality)` with 2 args, but shared exports `calculateSm2(input)` with 1 arg (different casing too). Will throw at runtime. |

### 🟡 Important (will cause silent failures)

| Issue | Location | Problem |
|-------|----------|---------|
| Worker never started | `src/index.ts` | `startSessionPrefetchWorker()` is exported from `workers/session-prefetch.worker.ts` but never called. The queue enqueues jobs that nothing processes. Prefetch feature is dead code. |
| Question field name mismatch | DB schema vs shared types | DB uses `body`, shared uses `content`, frontend mock uses `text`. Must align on one name. |

### 🟢 Minor

| Issue | Location | Problem |
|-------|----------|---------|
| Empty auth feature module | `features/auth/index.ts` | Exports `{}`. Can delete. |
| Difficulty type mismatch | `reviews.service.ts` | DB stores integer (1-5), XP system uses string keys ("easy"/"medium"/"hard"). |

---

## Part 5 — Integration Roadmap

Every phase follows the **new screen checklist** from `native_architecture.md`:

> 1. Define Zod schema in `@pruvi/shared` (if new endpoint)
> 2. Build server endpoint in `apps/server`
> 3. Create `services/{feature}.service.ts`
> 4. Create `hooks/use{Feature}.ts`
> 5. Create `components/{Feature}/*.tsx`
> 6. Create `app/{route}.tsx` screen

---

### Phase 0: Stabilize Backend + Shared Schemas ✅

> **Completed** — PR #2 (`feature/phase0-shared-schema-stabilization`), also included in PR #3
>
> Spec: `docs/superpowers/specs/2026-04-10-phase0-stabilize-shared-schemas-design.md`
> Plan: `docs/superpowers/plans/2026-04-10-phase0-stabilize-shared-schemas.md`

**What was done:**
- Added missing schemas to `@pruvi/shared`: `sessionSchema`, `clientQuestionSchema` (using `.omit()`), `startSessionBodySchema`, all session response schemas
- Added `Difficulty` type + `difficultyFromNumber()` mapper, `QualityScore` type, `INITIAL_SM2_STATE`
- Aligned SM-2 function: server now calls `calculateSm2({ ...state, quality })._unsafeUnwrap()` (single-object API)
- Re-exported `xp`, `lives`, `auth` modules from `index.ts` (fixed 6 broken imports)
- Aligned `easinessFactor` ↔ `easeFactor` mapping at server boundary
- Deleted stale `sm2.test.ts`, fixed server test mocks (difficulty string→number, `Math.round`)
- Worker confirmed as separate process (has `dev:worker` / `start:worker` scripts) — no fix needed

**Results:** 47/47 server tests pass, 19/19 shared tests pass. All schemas importable from `@pruvi/shared`.

---

### Phase 1: Frontend Foundation ✅

> **Completed** — PR #3 (`feature/phase1-frontend-foundation`)
>
> Spec: `docs/superpowers/specs/2026-04-11-phase1-frontend-foundation-design.md`
> Plan: `docs/superpowers/plans/2026-04-11-phase1-frontend-foundation.md`

**What was done:**
- **Dependencies:** Installed TanStack Query v5, Zustand v5, FlashList v1, react-hook-form + @hookform/resolvers. Removed @tanstack/react-form.
- **Archive:** Moved 20+ existing screens to `app/_legacy/` (Expo Router ignores `_` prefix). Deleted old `sign-in.tsx`, `sign-up.tsx`, `container.tsx`.
- **Navigation:** Created `(auth)/` + `(app)/(tabs)/` + `session/` + `subject/` route groups with placeholder screens. Drawer layout with no visible items (swipe disabled).
- **Root layout:** Rewrote with `QueryClientProvider` (staleTime 5min, retry 2) + `AuthGate` using Better Auth `useSession()` + loading spinner + redirect logic.
- **Common components:** Created `Screen` (SafeAreaView wrapper with scroll/padding options) and `Skeleton` (Reanimated opacity pulse). No custom Button (HeroUI's Button already used everywhere).
- **Auth screens:** `(auth)/login.tsx` and `(auth)/register.tsx` using react-hook-form + zodResolver + HeroUI components + `authService`.
- **Service layer:** Created `services/auth.service.ts` — first file in `services/`, establishes the pattern.

**Design decisions made:**
- Existing screens archived (not deleted) — preserved as copy-paste reference for later phases
- HeroUI's `Button` used directly — no custom wrapper needed
- Auth forms rewritten with react-hook-form during Phase 1 (not deferred) — clean cut, one form library
- Auth guard uses loading state while SecureStore resolves, then redirects

**Pending manual verification:** Run `pnpm dev` and test auth flow (login → redirect → tab bar → session persistence) against a running backend.

---

### Phase 2: Service Layer + Hooks + Stores ← NEXT

> **Goal:** The full data plumbing exists — every backend endpoint has a typed service function, a Query/Mutation hook, and ephemeral stores are ready. No UI yet — that's Phase 3.
>
> **Prerequisites:** Phase 1 PR merged. Backend running with seeded questions.

#### 2.1 — Service Layer

All services use `authClient.fetch()` for authenticated requests. Every response is parsed through `@pruvi/shared` Zod schemas.

**`services/auth.service.ts`**

```typescript
login(email, password)      → authClient.signIn.email()
register(name, email, password) → authClient.signUp.email()
logout()                    → authClient.signOut()
```

**`services/session.service.ts`**

| Function | Method | Endpoint | Request schema | Response schema |
|----------|--------|----------|---------------|-----------------|
| `getToday()` | GET | `/sessions/today` | — | `TodaySessionResponseSchema` |
| `startSession(mode)` | POST | `/sessions/start` | `StartSessionBodySchema` | `StartSessionResponseSchema` |
| `answerQuestion(questionId, selectedOptionIndex)` | POST | `/questions/:questionId/answer` | `AnswerQuestionBodySchema` | `AnswerQuestionResponseSchema` |
| `completeSession(id, questionCount, correctCount)` | POST | `/sessions/:id/complete` | `CompleteSessionBodySchema` | `CompleteSessionResponseSchema` |
| `getLives()` | GET | `/users/me/lives` | — | `LivesResponseSchema` |
| `getXp()` | GET | `/users/me/xp` | — | `XpResponseSchema` |
| `getStreaks()` | GET | `/streaks` | — | `StreakResponseSchema` |

**`services/progress.service.ts`**

| Function | Method | Endpoint | Response schema |
|----------|--------|----------|-----------------|
| `getSubjectStats()` | GET | `/users/me/progress` | `SubjectStatsResponseSchema` (to be defined) |
| `getReviewHistory(subjectSlug)` | GET | `/subjects/:slug/reviews` | `ReviewHistoryResponseSchema` (to be defined) |

> **Note:** `getSubjectStats` and `getReviewHistory` require **new backend endpoints** (see Phase 4 backend tasks).

#### 2.2 — TanStack Query Hooks

**`hooks/useSessionQuery.ts`** — Session lifecycle

| Hook | Type | Query key | Service call | Cache |
|------|------|-----------|-------------|-------|
| `useTodaySession()` | Query | `['session', 'today']` | `sessionService.getToday` | `staleTime: 5min` — pre-generated by BullMQ, no need to refetch constantly |
| `useStartSession()` | Mutation | invalidates `['session', 'today']` | `sessionService.startSession` | Invalidates session cache on success |
| `useAnswerQuestion()` | Mutation | invalidates `['lives']`, `['xp']` | `sessionService.answerQuestion` | Invalidates affected gamification caches |
| `useCompleteSession()` | Mutation | invalidates `['session', 'today']`, `['streaks']`, `['xp']` | `sessionService.completeSession` | Invalidates all post-session caches |

**`hooks/useLives.ts`**

| Hook | Type | Query key | Service call | Cache |
|------|------|-----------|-------------|-------|
| `useLives()` | Query | `['lives']` | `sessionService.getLives` | `staleTime: 30s` |

**`hooks/useXp.ts`**

| Hook | Type | Query key | Service call | Cache |
|------|------|-----------|-------------|-------|
| `useXp()` | Query | `['xp']` | `sessionService.getXp` | `staleTime: 60s` |

**`hooks/useStreaks.ts`**

| Hook | Type | Query key | Service call | Cache |
|------|------|-----------|-------------|-------|
| `useStreaks()` | Query | `['streaks']` | `sessionService.getStreaks` | `staleTime: 5min` |

**`hooks/useProgress.ts`**

| Hook | Type | Query key | Service call | Cache |
|------|------|-----------|-------------|-------|
| `useProgress()` | Query | `['progress']` | `progressService.getSubjectStats` | `staleTime: 5min` |
| `useSubjectReviews(slug)` | Query | `['subject', slug, 'reviews']` | `progressService.getReviewHistory` | `staleTime: 5min` |

**`hooks/useProfile.ts`**

| Hook | Type | Purpose |
|------|------|---------|
| `useProfile()` | Composed | Aggregates `useXp()` + `useStreaks()` + `useLives()` into a single profile object |

#### 2.3 — Zustand Stores

Ephemeral client state. Resets when the session ends. **Never persisted to SecureStore. Never used for server data.**

**`stores/sessionStore.ts`**

```typescript
interface SessionStore {
  currentQuestionIndex: number
  selectedOption: string | null
  answerState: 'idle' | 'correct' | 'wrong'
  livesRemaining: number
  actions: {
    selectOption: (optionId: string) => void
    submitAnswer: () => void
    nextQuestion: () => void
    reset: () => void
  }
}
```

- Drives the Q&A loop in `session/[id].tsx`
- `selectOption` → sets `selectedOption`, keeps `answerState: 'idle'`
- `submitAnswer` → triggers `useAnswerQuestion()` mutation, sets `answerState` to `'correct'` or `'wrong'` based on response
- `nextQuestion` → increments `currentQuestionIndex`, resets `selectedOption` and `answerState` to `'idle'`
- `reset` → called when navigating away from session

**`stores/gamificationStore.ts`**

```typescript
interface GamificationStore {
  pendingXP: number
  streakAnimationTrigger: boolean
  actions: {
    addXP: (amount: number) => void
    triggerStreakAnimation: () => void
    flush: () => void
  }
}
```

- `addXP` → accumulates XP earned during session (from `useAnswerQuestion` response `xpAwarded`)
- `triggerStreakAnimation` → fires on session result screen when streak extends
- `flush` → resets after animations complete

**Exit criteria:** All services, hooks, and stores exist with correct types. Can be imported and called — not wired to UI yet.

---

### Phase 3: Core Loop Screens

> **Goal:** A working study session from Home → Active Session → Result, with animations.

This is the **core product loop**. Everything is built on the plumbing from Phase 2.

#### 3.1 — Session Components (Reanimated)

All animations run on the UI thread via worklets. **Zero `setState` inside animation callbacks.**

| Component | File | Props | Animation |
|-----------|------|-------|-----------|
| `QuestionCard` | `components/session/QuestionCard.tsx` | `question: Question` (from `@pruvi/shared`) | None — renders body text + 4 `OptionButton` children |
| `OptionButton` | `components/session/OptionButton.tsx` | `option: string`, `letter: string`, `state: 'idle' \| 'selected' \| 'correct' \| 'wrong'`, `onPress` | Idle → tap: spring scale 0.97. Selected: bg transition + checkmark fade. Correct: spring to green + bounce scale. Wrong: horizontal shake (`withSequence(-8, 8, -8, 0)` @ 60ms each). **Must be `memo()`'d.** |
| `LivesBar` | `components/session/LivesBar.tsx` | `lives: number`, `maxLives: 5` | On life lost: horizontal shake (`withSequence(-8, 8, -8, 0)` @ 60ms each) |
| `ProgressBar` | `components/session/ProgressBar.tsx` | `current: number`, `total: number` | Animated width via `withTiming` |

#### 3.2 — Gamification Components (Reanimated)

| Component | File | Props | Animation |
|-----------|------|-------|-----------|
| `XPCounter` | `components/gamification/XPCounter.tsx` | `earnedXP: number` | `useSharedValue(0)` → `withTiming(earnedXP, { duration: 1200, easing: Easing.out(cubic) })` |
| `StreakBadge` | `components/gamification/StreakBadge.tsx` | `count: number` | Flame icon + count. Bounce on extension. |
| `CharacterAvatar` | `components/gamification/CharacterAvatar.tsx` | `expression: 'neutral' \| 'happy' \| 'sad'` | Expression state changes based on session performance |

#### 3.3 — Home Screen (`(app)/(tabs)/index.tsx`)

**Data flow:**

```
useTodaySession() ──→ session status (active/completed/null)
useStreaks()       ──→ current streak count
useLives()         ──→ remaining lives (hearts)
useXp()            ──→ XP + level for display
```

**Renders:**
- `StreakBadge` with current streak
- `LivesBar` with remaining lives
- Subject breakdown for the day's session (from `useTodaySession()` questions)
- "Start Session" `Button` → calls `useStartSession()` mutation → on success, navigate to `session/[id]` with returned session ID
- **Empty state:** "Você está em dia!" + time until next review (when today's session is completed)
- **Zero lives state:** Disable start button, show countdown to `resetsAt`
- Uses `Skeleton` components while queries load

#### 3.4 — Active Session (`(app)/session/[id].tsx`)

**Data flow:**

```
Route params               ──→ session ID
useSessionStore            ──→ currentQuestionIndex, selectedOption, answerState, livesRemaining
useAnswerQuestion() mut    ──→ POST /questions/:id/answer
useGamificationStore       ──→ accumulate pendingXP from each answer
```

**Loop:**
1. `QuestionCard` renders current question (from session questions array passed via params or cached query)
2. User taps `OptionButton` → `sessionStore.selectOption()`
3. Confirm button → `sessionStore.submitAnswer()` → `useAnswerQuestion()` mutation fires
4. Response arrives: `{ correct, correctOptionIndex, livesRemaining, xpAwarded }`
   - `correct=true` → `OptionButton` animates to green + bounce, `gamificationStore.addXP(xpAwarded)`
   - `correct=false` → `OptionButton` animates shake, `LivesBar` shakes, `sessionStore` updates `livesRemaining`
5. After animation settles → `sessionStore.nextQuestion()`
6. On last question → navigate to `session/result` with stats in route params
7. On `livesRemaining === 0` → navigate to `session/result` early (lives exhausted)

**Cleanup:** `sessionStore.reset()` on screen unmount (via `useEffect` cleanup).

#### 3.5 — Session Result (`(app)/session/result.tsx`)

**Data flow:**

```
Route params               ──→ questionCount, correctCount, sessionId
useGamificationStore       ──→ pendingXP (total earned during session)
useCompleteSession() mut   ──→ POST /sessions/:id/complete
useStreaks()               ──→ streak state after completion
```

**Renders:**
- `XPCounter` animates from 0 → `pendingXP`
- Accuracy percentage: `correctCount / questionCount * 100`
- Streak state: maintained / broken / extended (from `useStreaks()` after invalidation)
- `CharacterAvatar` with happy/sad expression based on performance
- "Continuar" `Button`:
  1. Calls `useCompleteSession()` mutation
  2. `queryClient.invalidateQueries(['session', 'today'])`
  3. `queryClient.invalidateQueries(['streaks'])`
  4. `queryClient.invalidateQueries(['xp'])`
  5. `gamificationStore.flush()`
  6. Navigate back to home

#### 3.6 — Cache Invalidation Summary

```
Answer question (during session):
  └── Invalidates: ['lives'], ['xp']

Session complete ("Continuar" pressed):
  ├── Server side: Redis keys session-today, streaks invalidated
  └── Client side: invalidateQueries(['session', 'today'], ['streaks'], ['xp'])
```

**Exit criteria:** Full study loop works end-to-end. User can start session, answer questions with animated feedback, see XP breakdown, return to home with updated stats.

---

### Phase 4: Progress & Profile Screens

> **Goal:** The remaining two tab screens and the subject detail screen.

#### 4.1 — New Backend Endpoints

These screens need data the backend doesn't serve yet:

| Method | Path | Response | Purpose |
|--------|------|----------|---------|
| `GET` | `/users/me/progress` | `{ subjects: [{ slug, name, totalQuestions, correctCount, accuracy }] }` | Per-subject accuracy stats from `review_log` + `subject` join |
| `GET` | `/subjects/:slug/reviews` | `{ reviews: [{ questionId, body, correct, reviewedAt }] }` | Review history for a specific subject |
| `GET` | `/users/me/calendar?month=YYYY-MM` | `{ dates: string[] }` | Dates with completed `daily_session` entries |

Define response schemas in `@pruvi/shared` first (following checklist step 1).

#### 4.2 — Subject Components

| Component | File | Purpose |
|-----------|------|---------|
| `SubjectCard` | `components/subject/SubjectCard.tsx` | FlashList item. Shows subject name + accuracy bar. Tap → `subject/[slug]`. **Must be `memo()`'d.** |

#### 4.3 — Progress Screen (`(app)/(tabs)/progress.tsx`)

**Data flow:**

```
useProgress()  ──→ per-subject accuracy stats
```

**Renders:**
- `FlashList` of `SubjectCard` components with accuracy progress bars
- Tap `SubjectCard` → navigate to `subject/[slug]`
- Uses `Skeleton` while loading

#### 4.4 — Subject Detail (`(app)/subject/[slug].tsx`)

**Data flow:**

```
useSubjectReviews(slug)  ──→ review history for this subject
```

**Renders:**
- Subject header with name + overall accuracy
- `FlashList` of recent reviews (question body, correct/wrong indicator, date)

#### 4.5 — Profile Screen (`(app)/(tabs)/profile.tsx`)

**Data flow:**

```
useProfile()     ──→ aggregated XP + streak + lives
useCalendar()    ──→ studied dates for calendar display (new hook, new service function)
```

**Renders:**
- `CharacterAvatar` with neutral expression
- XP progress bar to next level (from `useXp()` data: `totalXp`, `xpForNextLevel`)
- Total streak count via `StreakBadge`
- Study calendar grid (dates with completed sessions highlighted)
- Settings section: push notifications toggle, paper/pen mode toggle

**Exit criteria:** All 5 core screens functional and connected to real backend data. App matches the architecture doc's screen breakdown.

---

### Phase 5: Onboarding Persistence

> **Goal:** New user onboarding choices are saved to the backend and respected on subsequent launches.
>
> **Note:** This is the first feature **beyond** the scope of `native_architecture.md`. Follow the same patterns (service layer, shared schemas, hooks) but the navigation structure for onboarding is additive to the architecture doc's tree.

| # | Task | Where | Backend status |
|---|------|-------|---------------|
| 5.1 | Add columns to `user`: `selectedExam`, `prepTimeline`, `difficulties` (jsonb), `dailyStudyTime`, `onboardingCompleted` | `packages/db` | **New migration** |
| 5.2 | Define `UserPreferencesSchema`, `OnboardingCompleteSchema` in `@pruvi/shared` | `packages/shared/` | **New schemas** |
| 5.3 | Create `PUT /users/me/preferences` and `POST /onboarding/complete` endpoints | `apps/server` | **New feature** |
| 5.4 | Create `services/onboarding.service.ts` | `apps/native/services/` | Calls preference + complete endpoints |
| 5.5 | Create `hooks/useOnboarding.ts` | `apps/native/hooks/` | `useSavePreferences()` mutation, `useCompleteOnboarding()` mutation |
| 5.6 | Add onboarding route group under `(app)/` or as a separate `(onboarding)/` group | `apps/native/app/` | Wire screens to service layer |
| 5.7 | Root `_layout.tsx` checks `onboardingCompleted` from session data | Auth guard extended | Skip onboarding on subsequent launches |

---

### Phase 6: Content Features

> **Goal:** Additional study modes beyond the core daily session.
>
> All follow the new screen checklist: schema → endpoint → service → hook → component → screen.

| # | Feature | Backend scope | Frontend scope |
|---|---------|--------------|----------------|
| 6.1 | **Roleta configuration** (subject filter for sessions) | Extend `POST /sessions/start` to accept `subjectIds[]`, store preference | `services/session.service.ts` extended, config screen |
| 6.2 | **Flashcards** | Design decision: reuse SM-2 engine with card UI, or separate deck/card schema | `services/flashcard.service.ts`, `hooks/useFlashcards.ts`, new screens |
| 6.3 | **Simulados** (timed mock exams) | Timed session variant, simulado → question mapping | `services/simulado.service.ts`, `hooks/useSimulado.ts`, new screens |
| 6.4 | **Learning Trails** | Large: trail → unit → lesson → progress schema, 4+ endpoints, content | `services/trail.service.ts`, `hooks/useTrail.ts`, new screens |

---

### Phase 7: Social Features

> **Goal:** Friends, discovery, referrals.

| # | Feature | Backend scope | Frontend scope |
|---|---------|--------------|----------------|
| 7.1 | **Friends system** | `friendship` table, CRUD endpoints, suggestion algorithm | `services/friends.service.ts`, `hooks/useFriends.ts` |
| 7.2 | **User search** | Add `username` to user, `ILIKE` search endpoint | Extends `friends.service.ts` |
| 7.3 | **Contact sync** | Hash phone numbers, match against users | `services/contacts.service.ts`, native contact picker |
| 7.4 | **Phone/SMS verification** | SMS provider (Twilio/AWS SNS), OTP flow | Extends `auth.service.ts` |
| 7.5 | **Referral system** | Auto-generated codes, tracking table, XP rewards | `services/referral.service.ts` |
| 7.6 | **Weekly missions** | Mission definitions, progress tracking, weekly rotation | `services/missions.service.ts`, `hooks/useMissions.ts` |

---

### Phase 8: Monetization & Polish

| # | Feature | Scope |
|---|---------|-------|
| 8.1 | **Premium / subscriptions** | RevenueCat for mobile, feature gating middleware |
| 8.2 | **Push notifications** | Expo Push or FCM, token management, trigger system |
| 8.3 | **Achievements** | Criteria definitions, event-driven unlocking, `services/achievements.service.ts` |
| 8.4 | **Avatar upload** | File upload endpoint (S3/R2), `services/profile.service.ts` |
| 8.5 | **Real-time presence** | WebSocket or polling for friend online status |

---

## Part 6 — Architecture Rules

These rules from `native_architecture.md` apply to **every phase, every file, every PR.**

### State ownership

| What | Where | Never |
|------|-------|-------|
| Server data (sessions, XP, streaks, lives, questions) | TanStack Query hooks | Zustand, useState, context |
| Ephemeral UI state (quiz progress, animation triggers) | Zustand stores | TanStack Query, SecureStore |
| Auth session token | Better Auth + SecureStore | Manual token management |

### Service layer

- **Never call `fetch` from components or hooks.** All API calls go through `services/*.service.ts`.
- **Every service function parses responses through `@pruvi/shared` Zod schemas.** Types are `z.infer<>`, never manually duplicated.
- **If a schema doesn't exist in `@pruvi/shared`, add it there.** Do not create schemas in `apps/native`.

### Components

- **`memo()` all components** receiving stable props — especially FlashList items and `OptionButton`.
- **`useCallback` on all handlers** passed as props.
- **`Screen` wrapper** for every screen — never raw `SafeAreaView`.
- **`FlashList` for all lists** — never `FlatList` or `ScrollView` for item lists.
- **`Skeleton`** for all loading states — no spinners, no blank screens.

### Animations

- **All animations via Reanimated worklets** on the UI thread.
- **Zero `setState` inside animation callbacks.**
- **No animation logic in component state** — use `useSharedValue` and `useAnimatedStyle`.

### Performance

- `staleTime: 5min` on session queries (pre-generated by BullMQ).
- No `require()` in render paths (breaks Hermes bytecode).
- SVGs via `react-native-svg` — never PNG for icons.
- Images via Expo asset system — `require('./assets/...')` at module level, not in render.

### Auth flow

```
App launch
  → Root _layout.tsx checks session (Better Auth useSession hook)
    → No session   → redirect to /(auth)/login
    → Valid session → render (app)/ tree
      → Auth client attaches token to every request automatically
      → 401 from any service call → clear session → redirect to login
```

### New screen checklist (every phase)

1. Define Zod schema in `@pruvi/shared`
2. Build server endpoint in `apps/server`
3. Create `services/{feature}.service.ts`
4. Create `hooks/use{Feature}.ts`
5. Create `components/{Feature}/*.tsx`
6. Create `app/{route}.tsx` screen

---

## Part 7 — The Minimum Path to a Working Prototype

```
Phase 0  (stabilize backend + shared schemas)  ──→  Foundation       ✅ Done (PR #2, PR #3)
Phase 1  (frontend foundation)                  ──→  Skeleton         ✅ Done (PR #3)
Phase 2  (service layer + hooks + stores)       ──→  Plumbing         ← NEXT
Phase 3  (core loop screens)                    ──→  Working product
Phase 4  (progress + profile)                   ──→  Complete MVP
```

**What exists now:**
- `@pruvi/shared` exports all schemas both sides need (47/47 server tests, 19/19 shared tests pass)
- Native app has target navigation: `(auth)/` + `(app)/(tabs)/` + `session/` + `subject/`
- Auth guard works (useSession + loading + redirect)
- QueryClientProvider wrapping everything (staleTime 5min)
- `Screen` and `Skeleton` common components ready
- Auth screens (login/register) with react-hook-form + zod
- `services/auth.service.ts` establishing the service layer pattern
- 20+ pixel-perfect screens archived in `_legacy/` for reference

**What Phase 2 builds next:**
- `services/session.service.ts` — typed service functions for all session/gamification endpoints
- `services/progress.service.ts` — subject stats and review history (requires 2 new backend endpoints)
- TanStack Query hooks — `useTodaySession()`, `useStartSession()`, `useAnswerQuestion()`, `useLives()`, `useXp()`, `useStreaks()`, `useProgress()`, `useProfile()`
- Zustand stores — `sessionStore` (Q&A loop state), `gamificationStore` (XP animation state)

**After Phase 3:** A user can sign up → land on a properly structured home screen → start a daily study session → answer 10 SM-2-selected questions with Reanimated animated feedback → see lives decrease on wrong answers → view an animated XP breakdown on the result screen → return to home with updated stats → come back tomorrow for questions prioritized by their performance.

**After Phase 4:** All 5 core screens work end-to-end. The app matches the architecture document completely — navigation groups, service layer, typed Query hooks, Zustand stores for ephemeral UI state, Reanimated animations on the UI thread, FlashList for all lists, `@pruvi/shared` schemas as the single source of truth.

**Phases 5-8** add breadth (onboarding persistence, content modes, social features, monetization) on top of a solid, well-architected core. Each follows the same patterns established in Phases 1-4 — schema → endpoint → service → hook → component → screen — so they're mechanical to implement once the foundation exists.

**Phases 5-8** add breadth (onboarding persistence, content modes, social features, monetization) on top of a solid, well-architected core. Each follows the same patterns established in Phases 1-4 — schema → endpoint → service → hook → component → screen — so they're mechanical to implement once the foundation exists.
