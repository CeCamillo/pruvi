# Pruvi Integration Map

> Last updated: 2026-04-23
>
> This document maps every integration between `apps/native` and `apps/server`. All frontend work follows `apps/native/native_architecture.md` — that document is the single source of truth for how the native app is built.
>
> **Current status:** Phases 0-4 complete. **The 5 core MVP screens are wired end-to-end** — users sign up, start a daily session, answer SM-2 prioritized questions with animated feedback, earn XP, maintain streaks, and inspect per-subject progress + profile. Phase 5 (Onboarding Persistence) is next.

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

### Phase 2: Service Layer + Hooks + Stores ✅

> **Completed** — PR #4 (`feature/phase2-service-layer`)
>
> Spec: `docs/superpowers/specs/2026-04-11-phase2-service-layer-design.md`
> Plan: `docs/superpowers/plans/2026-04-11-phase2-service-layer.md`

**What was done:**

- **`lib/api-client.ts`** — Single `apiRequest<T>(path, options, schema)` wrapper around `authClient.$fetch`. Unwraps server's `{ success, data }` envelope, validates response through Zod schema, throws on failure. All authenticated HTTP goes through this.
- **`services/session.service.ts`** — 7 typed functions covering every existing backend endpoint: `getToday`, `startSession`, `completeSession`, `answerQuestion`, `getLives`, `getXp`, `getStreaks`. Each parses responses through `@pruvi/shared` schemas.
- **5 TanStack Query hook files:**
  - `useSessionQuery.ts` — `useTodaySession` (query) + `useStartSession`, `useAnswerQuestion`, `useCompleteSession` (mutations with cache invalidation)
  - `useLives.ts` (staleTime 30s) / `useXp.ts` (60s) / `useStreaks.ts` (5min default) — per-query staleTimes match server Redis TTLs
  - `useProfile.ts` — composed hook aggregating xp/streaks/lives into flat object
- **2 Zustand stores (v5 pattern, actions nested):**
  - `sessionStore` — `currentQuestionIndex`, `selectedOptionIndex`, `answerState`, `livesRemaining` + actions
  - `gamificationStore` — `pendingXP`, `streakAnimationTrigger` + actions
- **Added `@pruvi/shared` as workspace dependency** to native app (was missing from Phase 1).

**Design decisions made:**

- **Authenticated HTTP via `authClient.$fetch`** (not custom fetch wrapper) — Better Auth's Expo plugin already manages session cookies via SecureStore. Single source of truth for auth headers.
- **Services throw on failure** — TanStack Query's native `error` state handles errors in components. Matches the `login.tsx` pattern from Phase 1.
- **Query keys align with server Redis cache keys** (`session-today`, `lives`, `xp`, `streaks`) — mutations invalidate the same queries the server invalidates.
- **Per-query staleTimes match server Redis TTLs** — no point caching longer than server does.
- **Zustand actions nested under `actions` key** — lets components select state or actions separately to minimize re-renders (v5 best practice).
- **`selectedOptionIndex: number | null`** instead of `selectedOption: string | null` from the architecture doc draft — backend uses numeric indices 0-3, avoiding conversion bugs.
- **`streakAnimationTrigger: number` counter** instead of boolean — incrementing counter is robust to rapid-fire triggers.
- **`sessionStore.reset(initialLives)` takes lives count** — store reads current lives from `useLives()` on screen mount; store doesn't fetch its own data (respects server-state ownership rule).

**Deferred to Phase 4:**

- **`services/progress.service.ts`** + `useProgress()` + `useSubjectReviews()` — these depend on backend endpoints (`/users/me/progress`, `/subjects/:slug/reviews`) that don't exist yet. Defer to Phase 4 where we build the endpoints and consumers together.

**Results:** 9 new files, TypeScript compiles cleanly outside legacy archived screens.

---

### Phase 3: Core Loop Screens ✅

> **Completed** — PR #5 (`feature/phase3-core-loop-screens`)
>
> Spec: `docs/superpowers/specs/2026-04-16-phase3-core-loop-screens-design.md`
> Plan: `docs/superpowers/plans/2026-04-16-phase3-core-loop-screens.md`

**What was done:**

- **`lib/design-tokens.ts`** — Shared colors (primary `#58CD04`, accent `#FF9600`, danger, surface, text), typography (900/700/500 font weight scale), radii (sm through xxl) extracted from legacy screens. Single source of truth for visual language.
- **4 session components** (`components/session/`):
  - `QuestionCard` — renders question body + maps `question.options: string[]` to 4 `OptionButton` children, derives state per option
  - `OptionButton` — `memo()`'d, Reanimated animations for idle/selected/correct/wrong states. Press: spring scale 0.97. Correct: bounce 1.05. Wrong: horizontal shake (withSequence -8,8,-8,0 @ 60ms).
  - `LivesBar` — 5 Ionicons hearts (filled/outline), horizontal shake via `useRef` tracking previous `livesRemaining`
  - `ProgressBar` — segmented (one bar per question), each segment's bg color transitions on fill completion
- **3 gamification components** (`components/gamification/`):
  - `XPCounter` — animated counter 0→earnedXP using `useAnimatedReaction` + `runOnJS(setDisplayed)` pattern. 1200ms duration with `Easing.out(cubic)`.
  - `StreakBadge` — flame Ionicon + count, bounce on `animate` prop flip
  - `CharacterAvatar` — Ionicons face (happy/neutral/sad) with expression mapping
- **Home screen wired** (`(app)/(tabs)/index.tsx`): Header (StreakBadge + LivesBar), greeting with user name from `useSession()`, XP/Level card, today's session card with 4 states (loading/completed/in-progress/start) and zero-lives countdown.
- **Active Session wired** (`(app)/session/[id].tsx`): Reads session + questions from TanStack Query cache via `useQuery(["session", "active", id])`. Q&A loop driven by `sessionStore`. On mount: `sessionActions.reset(lives.data.lives)`. On answer: mutation → update store → `gamificationStore.addXP` → 1.2s animation delay → advance or navigate to result.
- **Session Result wired** (`(app)/session/result.tsx`): Reads params, computes accuracy, maps to CharacterAvatar expression (happy ≥70%, neutral ≥40%, sad <40%). `XPCounter` animates pendingXP. "Continuar" → `useCompleteSession` mutation → invalidate all queries (session-today, streaks, xp, lives) → `gamificationStore.flush()` → `router.replace` to home.

**Design decisions made:**

- **Scope: minimal core loop + legacy design tokens only** — skipped weekly activity chart, AI analysis card, mission cards, practice cards, subject breakdown on home. These appear in legacy screens but are out of Phase 3 scope. Polish arrives in later phases.
- **Session questions stored in TanStack Query cache** (not Zustand) — Home's `useStartSession` success handler calls `queryClient.setQueryData(["session", "active", id], response)`. Session screen reads via `useQuery` with `queryFn` that throws + `retry: false`. Respects architecture rule: server state in TanStack Query, not Zustand.
- **Router.replace (not push) to result screen** — user can't navigate back to mid-session after completing.
- **Auto-advance 1200ms after answer** — matches `OptionButton` correct bounce + `LivesBar` shake duration, gives user time to see feedback before next question.
- **`CharacterAvatar` uses Ionicons** (not custom illustrations) — no mascot assets exist and designing one is out of scope. Uses `happy`, `happy-outline` (for neutral with 70% opacity), `sad-outline`.
- **`sessionStore.reset(5)` on unmount** — ensures clean state bleed prevention. If user backs out mid-session and comes back, the next session starts fresh.
- **`correctCount` tracked in component state** (not store) — only used to compute navigation params on last question. The subtle timing issue (setState hasn't applied yet when navigating) is handled by computing `nextCorrectCount = correctCount + (res.correct ? 1 : 0)` inline.

**Deferred to later phases:**

- Weekly activity chart (needs `/users/me/calendar` — Phase 4)
- Subject breakdown on home card (needs `/users/me/progress` — Phase 4)
- Detailed explanations/stats on result screen (needs new question-detail endpoint — Phase 4+)
- AI analysis card (Phase 4+, stretch)
- Mission cards on home (Phase 7, weekly missions)
- Practice cards (Phase 6, flashcards + simulados)
- Pixel-perfect Figma recreation of legacy home with decorative SVGs, glows, gradient cards (polish phase)
- Character mascot illustrations (Phase 8, polish)

**Results:** 8 new files + 3 screens wired = 11 file changes. TypeScript compiles cleanly outside the pre-existing legacy files. **The core MVP study loop works end-to-end.**

---

### Phase 4: Progress & Profile Screens ✅

> **Goal:** The remaining two tab screens and the subject detail screen.
>
> **Prerequisites:** Phase 3 PR merged. This was the **first phase since Phase 0 that required backend work** — built three new endpoints before wiring the native side.

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

### Phase 5: Onboarding Persistence ← NEXT

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
Phase 0  (stabilize backend + shared schemas)  ──→  Foundation       ✅ Done (PR #2)
Phase 1  (frontend foundation)                  ──→  Skeleton         ✅ Done (PR #3)
Phase 2  (service layer + hooks + stores)       ──→  Plumbing         ✅ Done (PR #4)
Phase 3  (core loop screens)                    ──→  Working MVP      ✅ Done (PR #5)
Phase 4  (progress + profile)                   ──→  Complete MVP     ← NEXT
```

**What works end-to-end today (post Phase 3):**

The core study loop is functional. A real user can:
1. Register/login with email + password (Better Auth + SecureStore persistence)
2. Land on a properly structured home screen with StreakBadge, LivesBar, XP/Level card
3. Tap "Começar" → backend pre-generates 10 SM-2 prioritized questions
4. Answer each question with animated feedback (OptionButton scale bounce on correct, shake on wrong; LivesBar shake on life lost)
5. Auto-advance through 10 questions (or stop early at 0 lives)
6. See animated XP breakdown on result screen (XPCounter 0→total, accuracy %, StreakBadge, CharacterAvatar expression)
7. "Continuar" to home with updated stats (streak/XP/lives all invalidated and refetched)
8. Come back tomorrow — SM-2 prioritizes questions they got wrong, and the prefetch worker has cached the next session

**Infrastructure complete:**

- `@pruvi/shared` exports every schema both sides need (47/47 server tests, 19/19 shared tests pass)
- Native navigation: `(auth)/` + `(app)/(tabs)/` + `session/` + `subject/` with auth guard
- QueryClientProvider with sensible defaults (staleTime 5min, retry 2)
- Common components: `Screen`, `Skeleton`
- Design tokens module: colors, typography, radii
- Service layer: `auth.service.ts`, `session.service.ts` (7 endpoint functions), `lib/api-client.ts` wrapper
- 5 TanStack Query hook files covering session/lives/xp/streaks/profile
- 2 Zustand stores for ephemeral UI state (sessionStore, gamificationStore)
- 7 components with Reanimated animations (4 session + 3 gamification)
- 3 screens fully wired (home, active session, result)
- 20+ pixel-perfect legacy screens archived in `_legacy/` for reference

**What Phase 4 builds next:**

Backend work (first time since Phase 0):
- `GET /users/me/progress` — per-subject accuracy stats from `review_log` + `subject` join
- `GET /subjects/:slug/reviews` — review history for a subject
- `GET /users/me/calendar?month=YYYY-MM` — dates with completed `daily_session` entries
- Define corresponding Zod schemas in `@pruvi/shared`

Native work:
- `services/progress.service.ts` + `useProgress()`, `useSubjectReviews()`, `useCalendar()` hooks
- `components/subject/SubjectCard.tsx` (memo'd FlashList item)
- Wire `(app)/(tabs)/progress.tsx` — FlashList of SubjectCards
- Wire `(app)/subject/[slug].tsx` — subject detail with review history FlashList
- Wire `(app)/(tabs)/profile.tsx` — CharacterAvatar + XP progress + streak + study calendar + settings placeholders

**After Phase 4:** All 5 core screens work end-to-end. The app matches the architecture document completely — navigation groups, service layer, typed Query hooks, Zustand stores for ephemeral UI state, Reanimated animations on the UI thread, FlashList for all lists, `@pruvi/shared` schemas as the single source of truth.

**Phases 5-8** add breadth (onboarding persistence, content modes, social features, monetization) on top of a solid, well-architected core. Each follows the same patterns established in Phases 1-4 — schema → endpoint → service → hook → component → screen — so they're mechanical to implement once the foundation exists.

---

## Part 8 — Cross-Phase Design Decisions (Reference)

Key decisions made during implementation that shape the codebase and may need to be revisited:

### Architecture decisions

| Decision | Phase | Rationale | Revisit if... |
|----------|-------|-----------|---------------|
| `@pruvi/shared` exports raw `.ts` (no build step) | 0 | Workspace packages resolve TS directly via pnpm + Expo bundler. Simpler, no build pipeline. | Publishing shared package outside the monorepo |
| SM-2 single-object API (`calculateSm2(input)`) | 0 | Matches existing tests, cleaner than 2-arg variant | SM-2 needs to accept additional context (user, question metadata) |
| `Difficulty` = string enum (`easy`\|`medium`\|`hard`) | 0 | DB stores integer 1-5, mapped via `difficultyFromNumber` at the boundary. XP calculation uses string keys. | Granularity needs to expand to 5 tiers |
| `auth.ts` in `@pruvi/shared` contains non-auth schemas | 0 | File was misnamed in legacy — holds AnswerQuestionBodySchema, StreakResponseSchema. Kept as-is to avoid churn. | Convenient time to split into separate files |
| Worker runs as separate process | 0 | Dockerfile currently only runs server. Worker needs its own deployment. | Scaling — maybe co-locate, maybe split further |

### Frontend architecture

| Decision | Phase | Rationale | Revisit if... |
|----------|-------|-----------|---------------|
| Archive legacy screens to `app/_legacy/` (Expo Router ignores `_` prefix) | 1 | Preserves pixel-perfect UI work as copy-paste reference for later phases | Legacy UI no longer relevant |
| Use HeroUI's `Button` (not custom wrapper) | 1 | Already used across all existing screens. Wrapping adds indirection. | HeroUI dropped or migrated away from |
| Rewrite auth forms with react-hook-form (not keep @tanstack/react-form) | 1 | Architecture doc mandates react-hook-form. Two form libs = confusion. | User strongly prefers @tanstack/react-form |
| Auth guard in root `_layout.tsx` only, not per-screen | 1 | Single source of truth. Screens inside `(app)/` never check auth. | Need per-screen permissions (e.g., admin-only screens) |
| `authClient.$fetch` for authenticated requests | 2 | Better Auth's plugin already handles session cookies. No custom token management. | Need to call non-auth server from native (different baseURL) |
| Services throw on failure (no Result type) | 2 | TanStack Query's native error state handles UX. Matches Phase 1 login pattern. | Need fine-grained error types distinct from throws |
| Query keys = server Redis cache keys | 2 | `['lives']`, `['xp']`, `['streaks']`, `['session', 'today']` mirror server-side invalidation | Server changes cache key schema |
| Per-query staleTime = server Redis TTL | 2 | No point caching longer than server does | Server caching strategy changes |
| Zustand actions nested under `actions` key | 2 | v5 best practice — lets components select state or actions without extra re-renders | Zustand pattern changes |
| Session questions in TanStack Query cache (not Zustand) | 3 | Server data = Query. Home screen calls `setQueryData` after `useStartSession` success. | Need to modify questions mid-session (unlikely) |
| `router.replace` (not push) to result screen | 3 | User can't back-nav to a finished session | User feedback requests the ability |
| 1200ms auto-advance after answer | 3 | Matches OptionButton correct bounce + LivesBar shake duration | A/B test shows different feel better |

### Scope boundaries (what we deferred)

| Deferred | To phase | Why |
|----------|----------|-----|
| `progress.service.ts`, `useProgress()`, `useSubjectReviews()` | 4 | Backend endpoints don't exist yet — build service + endpoints together |
| Subject breakdown on home screen | 4 | Needs `/users/me/progress` endpoint |
| Weekly activity chart on home | 4 | Needs `/users/me/calendar` endpoint |
| Detailed explanations/stats on result screen | 4+ | Requires new question-detail endpoints |
| Onboarding persistence | 5 | Current onboarding UI in `_legacy/`, no backend yet — `user` table needs `selectedExam`, `prepTimeline`, `difficulties`, `dailyStudyTime`, `onboardingCompleted` columns |
| Roleta subject filtering | 6 | Extend `POST /sessions/start` to accept `subjectIds[]` |
| Flashcards | 6 | Design decision pending: reuse SM-2 engine with card UI vs. separate schema |
| Simulados (timed mock exams) | 6 | Timed session variant |
| Learning Trails | 6 | Large new schema: trail → unit → lesson → progress |
| Friends/social | 7 | `friendship` table, CRUD endpoints, suggestion algorithm |
| User search | 7 | Add `username` to user table, `ILIKE` search |
| Contact sync | 7 | Hash + match phone numbers |
| Phone/SMS verification | 7 | SMS provider integration (Twilio/AWS SNS) |
| Referral system | 7 | Auto-generated codes + tracking |
| Weekly missions | 7 | Definitions + progress tracking |
| Premium/subscriptions | 8 | RevenueCat + feature gating |
| Push notifications | 8 | Expo Push + trigger system |
| Achievements | 8 | Criteria + event-driven unlocking |
| Avatar upload | 8 | File upload + S3/R2 storage |
| Real-time presence | 8 | WebSocket or polling |
| Character mascot illustrations | 8 | Replaces Ionicons placeholder in CharacterAvatar |
| Pixel-perfect legacy home recreation | polish | Decorative SVGs, glows, gradient cards — lower priority than feature breadth |
