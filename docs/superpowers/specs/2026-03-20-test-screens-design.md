# Test Screens Design — 5-Screen React Native Flow

## Context

Pruvi has a complete backend (Fastify + PostgreSQL + Redis + BullMQ) with 8 API endpoints covering auth, study sessions, question answering, lives, XP/leveling, and streaks. The mobile app (Expo + React Native) currently only has auth screens (sign-in/sign-up). We need a minimal set of screens to exercise every backend endpoint through a realistic user flow — for testing purposes, not production UI.

## Architecture

### Navigation Structure

```
app/
  _layout.tsx              (Root Stack — existing, modified)
  (drawer)/
    _layout.tsx            (Drawer — existing, modified: remove tabs, add dashboard)
    index.tsx              (Home — existing, modified: add session buttons)
    dashboard.tsx          (NEW — Screen 5: all stats)
  (quiz)/
    _layout.tsx            (NEW — Stack for quiz flow)
    mode-select.tsx        (NEW — Screen 2: choose mode + stats bar)
    quiz.tsx               (NEW — Screen 3: answer questions)
    results.tsx            (NEW — Screen 4: session summary)
```

**Why this structure:** The `(quiz)` group is a sibling to `(drawer)` at the root Stack level. This gives the quiz flow its own fullscreen Stack (no drawer hamburger during quiz). The Dashboard lives in the drawer as a persistent top-level destination.

**Deleted:** `apps/native/app/(drawer)/(tabs)/` (3 placeholder files).

### API Client

**File:** `apps/native/lib/api-client.ts`

A typed fetch wrapper that:
1. Reads base URL from `env.EXPO_PUBLIC_SERVER_URL`
2. Attaches session cookie from `authClient.getCookie()` as `cookie` header (matches Better-Auth Expo's own pattern at line 291 of the expo client source)
3. Parses responses through Zod schemas for e2e type safety
4. Expects the server's `{ success: true, data: T }` envelope

```typescript
export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T>
export async function apiPost<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>
```

**Auth mechanism:** Better-Auth's Expo plugin stores session cookies in SecureStore and exposes `getCookie()` which formats them as a `cookie` header string. The server's `authenticate` preHandler calls `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })` which reads cookies. Our API client attaches the same `cookie` header that Better-Auth itself uses. Import env via `import { env } from "@pruvi/env/native"`.

**Error handling:** The API client throws on `success: false` responses with the error message. Screens use try/catch with `Alert.alert()` to surface errors during testing. If `getCookie()` returns an empty string (not authenticated), skip the `cookie` header.

### Dependency

Add `@pruvi/shared: "workspace:*"` to `apps/native/package.json`. Use deep imports (e.g. `@pruvi/shared/questions`) to avoid pulling in `neverthrow` via the barrel export's `sm2.ts` re-export.

## Screen Specifications

### Screen 1: Home (existing — enhance)

**File:** `apps/native/app/(drawer)/index.tsx`
**Endpoints:** `GET /sessions/today`

**Changes:** When authenticated, add below the welcome card:
- **"Start Study Session"** button → `router.push("/(quiz)/mode-select")`
- **"Check Today's Session"** button → calls `GET /sessions/today`, shows session status inline (active/completed/none)

Auth forms (sign-in/sign-up/sign-out) remain unchanged.

### Screen 2: Mode Select

**File:** `apps/native/app/(quiz)/mode-select.tsx`
**Endpoints on mount:** `GET /users/me/lives`, `GET /users/me/xp`, `GET /streaks` (parallel)
**Endpoint on action:** `POST /sessions/start`

**Layout:**
- Stats bar at top: lives (hearts), XP + level, current streak
- Two mode cards: "All Questions" and "Theoretical Only"
- "Go to Dashboard" link at bottom

**On mode tap:**
1. Call `POST /sessions/start` with `{ mode }`
2. Store questions in a module-level variable (avoids URL length limits from serializing question arrays through route params)
3. Navigate to quiz: `router.push({ pathname: "/(quiz)/quiz", params: { sessionId: String(data.session.id) } })`

**Shared quiz store:** A simple module-level store at `apps/native/lib/quiz-store.ts` holds the questions array between screens. This avoids serialization overhead and URL length limits while keeping things simple for a test harness.

### Screen 3: Quiz

**File:** `apps/native/app/(quiz)/quiz.tsx`
**Endpoints:** `POST /questions/:questionId/answer` (per question), `POST /sessions/:id/complete` (after last)

**State:** `questions` (from quiz-store module), `sessionId` (from route params), `currentIndex`, `selectedOption`, `feedback`, `correctCount`, `totalXpEarned`

**Flow per question:**
1. Show question text + 4 option buttons
2. User taps option → set `selectedOption`, disable options
3. Call `POST /questions/:questionId/answer` with `{ selectedOptionIndex }`
4. Show feedback: green highlight for correct option, red for wrong selection, XP awarded text
5. "Next" button → advance index, reset state
6. After last question: "Finish" button → `POST /sessions/:id/complete` with `{ questionCount: questions.length, correctCount }` → navigate to results

**Navigation to results:** `router.replace` (prevents back-navigation into completed quiz)
- Params: `sessionId`, `questionCount`, `correctCount`, `totalXpEarned`
- Note: `streak` is NOT returned by the complete endpoint (it only returns the session row). The Results screen fetches streak separately via `GET /streaks`.

### Screen 4: Results

**File:** `apps/native/app/(quiz)/results.tsx`
**Endpoints:** `GET /streaks` (on mount, to display current streak)

**Data:** Score and XP from route params. Streak fetched on mount since the complete endpoint doesn't return it.

**Layout:**
- "Session Complete!" header
- Score: X / Y
- XP earned: +N
- Streak: N days (from `GET /streaks`)
- "Go to Dashboard" button → `router.replace("/(drawer)/dashboard")`
- "Back to Home" button → `router.replace("/(drawer)/")`

### Screen 5: Dashboard

**File:** `apps/native/app/(drawer)/dashboard.tsx`
**Endpoints on mount:** `GET /users/me/lives`, `GET /users/me/xp`, `GET /streaks`, `GET /sessions/today` (parallel)

**Layout sections:**
- **Lives:** Heart icons (filled/empty), reset timer if applicable
- **XP & Level:** Level number, XP progress, XP to next level
- **Streaks:** Current streak, longest streak, total sessions
- **Today's Session:** Status (none/active/completed), score if completed
- "Start New Session" button → `router.push("/(quiz)/mode-select")`

## Endpoint Coverage Matrix

| Endpoint | Method | Screen(s) | Trigger |
|---|---|---|---|
| `/api/auth/*` | POST | Home | Sign-up/in/out buttons |
| `/sessions/start` | POST | Mode Select | Mode card tap |
| `/sessions/today` | GET | Home, Dashboard | Button tap / on mount |
| `/sessions/:id/complete` | POST | Quiz | "Finish" on last question |
| `/questions/:id/answer` | POST | Quiz | Each question submission |
| `/users/me/lives` | GET | Mode Select, Dashboard | On mount |
| `/users/me/xp` | GET | Mode Select, Dashboard | On mount |
| `/streaks` | GET | Mode Select, Dashboard | On mount |

**All 8 endpoints exercised.** Every endpoint is called at least once in the happy path flow: Home → Mode Select → Quiz → Results → Dashboard.

## Files Summary

| Action | File | Purpose |
|---|---|---|
| **Create** | `apps/native/lib/api-client.ts` | Authenticated fetch + Zod parsing |
| **Create** | `apps/native/lib/quiz-store.ts` | Module-level store for questions between screens |
| **Create** | `apps/native/app/(quiz)/_layout.tsx` | Stack layout for quiz flow |
| **Create** | `apps/native/app/(quiz)/mode-select.tsx` | Screen 2 |
| **Create** | `apps/native/app/(quiz)/quiz.tsx` | Screen 3 |
| **Create** | `apps/native/app/(quiz)/results.tsx` | Screen 4 |
| **Create** | `apps/native/app/(drawer)/dashboard.tsx` | Screen 5 |
| **Modify** | `apps/native/app/_layout.tsx` | Add `(quiz)` to root Stack with `headerShown: false` |
| **Modify** | `apps/native/app/(drawer)/_layout.tsx` | Remove `(tabs)` Drawer.Screen, add `dashboard` Drawer.Screen |
| **Modify** | `apps/native/app/(drawer)/index.tsx` | Add session buttons |
| **Modify** | `apps/native/package.json` | Add `@pruvi/shared` dep |
| **Modify** | `packages/shared/src/sessions.ts` | Fix `CompleteSessionResponseSchema` to match server |
| **Modify** | `apps/server/src/features/sessions/sessions.route.ts` | Wrap `today` response to match schema |
| **Modify** | `apps/server/src/index.ts` | Add `cookie` to CORS `allowedHeaders` |
| **Delete** | `apps/native/app/(drawer)/(tabs)/` | Remove placeholder tabs (3 files) |

## Server-Side Fixes Required

The spec review revealed that 2 shared Zod schemas don't match the server's actual response shapes. These must be fixed **before** the mobile screens can use Zod parsing reliably.

### Fix 1: `GET /sessions/today` response shape

**Problem:** `TodaySessionResponseSchema` expects `{ session: Session | null }` but the server returns the session (or null) directly in `data`.

**Fix:** Update `apps/server/src/features/sessions/sessions.route.ts` (line 68-72) to wrap the response:
```typescript
// Before: return unwrapResult(result);
// After:
const session = unwrapResult(result).data;
return successResponse({ session });
```

Also fix the cached path (line 62-65) to ensure consistency.

### Fix 2: `POST /sessions/:id/complete` response shape

**Problem:** `CompleteSessionResponseSchema` expects `{ session: Session, streak: number }` but the server returns the raw session row without wrapping or streak.

**Fix options:**
- **(a)** Update server to compute streak and return `{ session: completed, streak }` — matches the shared schema intent
- **(b)** Update `CompleteSessionResponseSchema` to just be `SessionSchema` — simpler but loses streak data

**Recommendation:** Option (b) for this test harness — the Results screen fetches streak via `GET /streaks` anyway. Update `CompleteSessionResponseSchema` in `packages/shared/src/sessions.ts` and wrap the server response.

### Fix 3: CORS `cookie` header

**Problem:** Server's CORS `allowedHeaders` doesn't include `cookie`. Native apps bypass CORS, but if Expo web is ever used for testing, it would fail.

**Fix:** Add `"cookie"` to the `allowedHeaders` array in `apps/server/src/index.ts`.

## Key Design Decisions

1. **Cookie auth via `authClient.getCookie()`** — matches Better-Auth Expo's own internal pattern. No separate Bearer token flow exists.
2. **Module-level quiz store** — avoids URL length limits from serializing question arrays through route params. Simple module variable, not a state management library.
3. **`router.replace` from Quiz → Results** — prevents back-navigation into a completed quiz.
4. **Deep imports from `@pruvi/shared`** — avoids pulling `neverthrow` into the mobile bundle via the barrel export.
5. **Zod parsing in API client** — e2e type safety: shared schemas validate both server output and client input.
6. **`(quiz)` as root Stack sibling** — quiz is fullscreen without drawer chrome.
7. **Results screen fetches streak separately** — the complete endpoint doesn't return streak data, so Results calls `GET /streaks` on mount.
