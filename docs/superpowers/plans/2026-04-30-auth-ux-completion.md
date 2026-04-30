# Auth UX Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Better-Auth's existing sign-in/sign-up reachable through a hardened, testable auth gate, wire logout, and stop the server URL env var from being silently optional.

**Architecture:** Single `AuthGate` at `app/_layout.tsx` reads session + onboarding-completion signals and routes to `(auth)`, `(onboarding)`, or `(app)`. The redirect logic is extracted as a pure function (`getAuthRedirectTarget`) to make all 9 routing rules unit-testable. Error-code → Portuguese mapping lives in `lib/auth-errors.ts`. Logout uses a confirmation alert + `authClient.signOut()` + `queryClient.clear()`; the `AuthGate` handles redirection automatically.

**Tech Stack:** Expo Router v4, Better-Auth + Better-Auth Expo plugin, TanStack Query v5, react-hook-form + zod, `bun:test` for unit tests, `@t3-oss/env-core` for env validation.

**Spec:** `docs/superpowers/specs/2026-04-30-auth-ux-completion-design.md`

---

## File Structure

**New files (`apps/native/`):**

| Path | Responsibility |
|------|----------------|
| `lib/auth-redirect.ts` | Pure function `getAuthRedirectTarget(session, prefs, segments) → AuthRedirectResult`. The 9-row redirect table. |
| `lib/__tests__/auth-redirect.test.ts` | Unit tests for every row of the redirect table. |
| `lib/auth-errors.ts` | `getAuthErrorMessage(error: unknown): string`. Maps Better-Auth error codes to Portuguese copy. |
| `lib/__tests__/auth-errors.test.ts` | Unit tests for known error codes + fallback. |
| `lib/ui/confirm.ts` | `confirmDestructiveAction(title: string, message?: string): Promise<boolean>`. Wraps `Alert.alert`. |
| `lib/__tests__/confirm.test.ts` | Unit tests by mocking `Alert.alert`. |

**Modified files (`apps/native/`):**

| Path | Change |
|------|--------|
| `app/_layout.tsx` | `AuthGate` switches from inline branches to `getAuthRedirectTarget`. |
| `app/(auth)/login.tsx` | Replace inline error string with `getAuthErrorMessage`. |
| `app/(auth)/register.tsx` | Same. |
| `app/(app)/(tabs)/profile.tsx` | Add interim "Sair" button (later moves to `mais.tsx` when drawer UI ports). |

**Modified file (`packages/env/`):**

| Path | Change |
|------|--------|
| `packages/env/src/native.ts` | `EXPO_PUBLIC_SERVER_URL` from `.optional()` to required `z.url()`. |
| `packages/env/src/__tests__/native.test.ts` | New: assert schema rejects missing/empty URL. |

**No backend changes.** Sub-project #1 is FE-only.

---

## Branch Strategy

This plan assumes work happens on a **new branch off `feature/phase4-progress-subject`**, not the current `feature/onboarding-screens`. Phase4 has the working backend, the auth scaffolding (~80% of this spec), and the SM-2 + sessions wiring; the merged-UI branch lacks all of that. The mocked drawer UI from `feature/onboarding-screens` will be ported in a later sub-project — it's not needed to land auth completion.

The Sair button lives on `profile.tsx` for now; when the drawer/`mais.tsx` UI is ported, the handler moves there.

---

## Task 0: Branch Reconciliation

**Goal:** Establish `feature/auth-ux-completion` from `feature/phase4-progress-subject` and verify the baseline runs.

**Files:** None (pure git + verification).

- [ ] **Step 1: Confirm clean working tree on the current branch**

```bash
git status
```
Expected: `nothing to commit, working tree clean` (the design spec is already committed).

- [ ] **Step 2: Switch to phase4 and pull latest**

```bash
git checkout feature/phase4-progress-subject
git pull --ff-only origin feature/phase4-progress-subject
```
Expected: `Already up to date.` or fast-forward output.

- [ ] **Step 3: Create the feature branch**

```bash
git checkout -b feature/auth-ux-completion
```
Expected: `Switched to a new branch 'feature/auth-ux-completion'`.

- [ ] **Step 4: Cherry-pick the design + plan docs from `feature/onboarding-screens`**

```bash
git cherry-pick 0743d08
```
Expected: `[feature/auth-ux-completion <sha>] docs: auth ux completion design spec (Tier 1 #1)`.

(After implementing, the plan doc itself will be committed in Task 6.)

- [ ] **Step 5: Verify backend tests pass on the baseline**

```bash
cd apps/server && pnpm test
```
Expected: all tests green. (Sanity check — no FE work has touched server yet.)

- [ ] **Step 6: Verify native typecheck passes on the baseline**

```bash
cd ../native && pnpm typecheck
```
Expected: `Found 0 errors.`

- [ ] **Step 7: Commit the plan doc**

```bash
git add docs/superpowers/plans/2026-04-30-auth-ux-completion.md
git commit -m "docs: auth ux completion implementation plan"
```

---

## Task 1: Extract `getAuthRedirectTarget` Pure Function (TDD)

**Goal:** Lift the routing logic out of `AuthGate` JSX into a pure function that takes (session, prefs, segments) and returns a typed result. Cover every row of the redirect table with unit tests.

**Files:**
- Create: `apps/native/lib/auth-redirect.ts`
- Create: `apps/native/lib/__tests__/auth-redirect.test.ts`
- Modify: `apps/native/app/_layout.tsx` (lines 30–80, the AuthGate branches)

- [ ] **Step 1: Write the failing test**

Create `apps/native/lib/__tests__/auth-redirect.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { getAuthRedirectTarget } from "../auth-redirect";

const sessionPending = { isPending: true, error: null, data: null } as const;
const sessionError = { isPending: false, error: new Error("net"), data: null } as const;
const sessionNone = { isPending: false, error: null, data: null } as const;
const sessionOk = { isPending: false, error: null, data: { user: { id: "u1" } } } as const;

const prefsPending = { isPending: true, data: undefined } as const;
const prefsIncomplete = { isPending: false, data: { onboardingCompleted: false } } as const;
const prefsComplete = { isPending: false, data: { onboardingCompleted: true } } as const;

describe("getAuthRedirectTarget", () => {
  it("loading while session is pending", () => {
    expect(getAuthRedirectTarget(sessionPending, prefsPending, []))
      .toEqual({ kind: "loading" });
  });

  it("error when session check failed", () => {
    expect(getAuthRedirectTarget(sessionError, prefsPending, []))
      .toEqual({ kind: "error" });
  });

  it("stays on (auth) when unauthenticated", () => {
    expect(getAuthRedirectTarget(sessionNone, prefsPending, ["(auth)"]))
      .toEqual({ kind: "stay" });
  });

  it("redirects to /(auth)/login when unauthenticated outside (auth)", () => {
    expect(getAuthRedirectTarget(sessionNone, prefsPending, ["(app)"]))
      .toEqual({ kind: "redirect", href: "/(auth)/login" });
  });

  it("loading while prefs pending after session resolved", () => {
    expect(getAuthRedirectTarget(sessionOk, prefsPending, ["(app)"]))
      .toEqual({ kind: "loading" });
  });

  it("stays in (onboarding) when authenticated and onboarding incomplete", () => {
    expect(getAuthRedirectTarget(sessionOk, prefsIncomplete, ["(onboarding)"]))
      .toEqual({ kind: "stay" });
  });

  it("redirects to onboarding/start when authenticated and onboarding incomplete elsewhere", () => {
    expect(getAuthRedirectTarget(sessionOk, prefsIncomplete, ["(app)"]))
      .toEqual({ kind: "redirect", href: "/(onboarding)/start" });
  });

  it("redirects to /(app) when authenticated, onboarded, but in (auth)", () => {
    expect(getAuthRedirectTarget(sessionOk, prefsComplete, ["(auth)"]))
      .toEqual({ kind: "redirect", href: "/(app)/(tabs)" });
  });

  it("redirects to /(app) when authenticated, onboarded, but in (onboarding)", () => {
    expect(getAuthRedirectTarget(sessionOk, prefsComplete, ["(onboarding)"]))
      .toEqual({ kind: "redirect", href: "/(app)/(tabs)" });
  });

  it("stays in (app) when authenticated and onboarded", () => {
    expect(getAuthRedirectTarget(sessionOk, prefsComplete, ["(app)"]))
      .toEqual({ kind: "stay" });
  });

  it("treats empty segments as stay (cold-start race)", () => {
    expect(getAuthRedirectTarget(sessionOk, prefsComplete, []))
      .toEqual({ kind: "stay" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/native && bun test lib/__tests__/auth-redirect.test.ts
```
Expected: failure with `Cannot find module '../auth-redirect'`.

- [ ] **Step 3: Implement `getAuthRedirectTarget`**

Create `apps/native/lib/auth-redirect.ts`:

```ts
import type { Href } from "expo-router";

type SessionState = {
  isPending: boolean;
  error: unknown;
  data: { user: { id: string } } | null;
};

type PrefsState = {
  isPending: boolean;
  data: { onboardingCompleted: boolean } | undefined;
};

export type AuthRedirectResult =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "stay" }
  | { kind: "redirect"; href: Href };

export function getAuthRedirectTarget(
  session: SessionState,
  prefs: PrefsState,
  segments: readonly string[]
): AuthRedirectResult {
  if (session.isPending) return { kind: "loading" };
  if (session.error) return { kind: "error" };

  // Empty segments only happen for one render on cold-start before the URL
  // is resolved. Treat as "stay" so we don't push redirects into nowhere.
  if (segments.length === 0) return { kind: "stay" };

  const inAuth = segments[0] === "(auth)";
  const inOnboarding = segments[0] === "(onboarding)";

  if (!session.data) {
    if (inAuth) return { kind: "stay" };
    return { kind: "redirect", href: "/(auth)/login" };
  }

  if (prefs.isPending) return { kind: "loading" };
  const completed = prefs.data?.onboardingCompleted === true;

  if (!completed) {
    if (inOnboarding) return { kind: "stay" };
    return { kind: "redirect", href: "/(onboarding)/start" };
  }

  if (inAuth || inOnboarding) {
    return { kind: "redirect", href: "/(app)/(tabs)" };
  }
  return { kind: "stay" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun test lib/__tests__/auth-redirect.test.ts
```
Expected: all 11 tests pass.

- [ ] **Step 5: Replace AuthGate's inline branches with the pure function**

Modify `apps/native/app/_layout.tsx`. Replace the `AuthGate` function body with:

```tsx
function AuthGate() {
  const session = authClient.useSession();
  const segments = useSegments();
  const prefs = usePreferences({ enabled: !!session.data });

  const result = getAuthRedirectTarget(
    {
      isPending: session.isPending,
      error: session.error,
      data: session.data ?? null,
    },
    {
      isPending: prefs.isPending,
      data: prefs.data ?? undefined,
    },
    segments
  );

  if (result.kind === "loading") return <LoadingScreen />;
  if (result.kind === "error") {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-foreground text-base text-center">
          Não foi possível verificar sua sessão. Verifique sua conexão e tente novamente.
        </Text>
      </View>
    );
  }
  if (result.kind === "redirect") return <Redirect href={result.href} />;
  return <Slot />;
}
```

Add the import at the top of `_layout.tsx`:

```tsx
import { getAuthRedirectTarget } from "@/lib/auth-redirect";
```

Verify these existing imports remain (they are still used): `Redirect`, `Slot`, `useSegments`, `Spinner`, `Text`, `View`, `authClient`, `usePreferences`.

- [ ] **Step 6: Run typecheck + tests**

```bash
pnpm typecheck && bun test lib/__tests__/auth-redirect.test.ts
```
Expected: typecheck clean, all redirect tests still passing.

- [ ] **Step 7: Commit**

```bash
git add apps/native/lib/auth-redirect.ts \
        apps/native/lib/__tests__/auth-redirect.test.ts \
        apps/native/app/_layout.tsx
git commit -m "refactor(native): extract auth redirect logic to pure function with tests"
```

---

## Task 2: Add `getAuthErrorMessage` Helper (TDD)

**Goal:** Replace the bare-string error fallbacks in login/register with a single helper that maps Better-Auth error codes to Portuguese copy.

**Files:**
- Create: `apps/native/lib/auth-errors.ts`
- Create: `apps/native/lib/__tests__/auth-errors.test.ts`
- Modify: `apps/native/app/(auth)/login.tsx` (the `onSubmit` handler around line 118)
- Modify: `apps/native/app/(auth)/register.tsx` (the equivalent handler)

- [ ] **Step 1: Write the failing test**

Create `apps/native/lib/__tests__/auth-errors.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { getAuthErrorMessage } from "../auth-errors";

describe("getAuthErrorMessage", () => {
  it("maps INVALID_EMAIL_OR_PASSWORD to Portuguese", () => {
    expect(getAuthErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }))
      .toBe("Email ou senha incorretos.");
  });

  it("maps USER_ALREADY_EXISTS to Portuguese", () => {
    expect(getAuthErrorMessage({ code: "USER_ALREADY_EXISTS" }))
      .toBe("Já existe uma conta com esse email.");
  });

  it("maps PASSWORD_TOO_SHORT to Portuguese", () => {
    expect(getAuthErrorMessage({ code: "PASSWORD_TOO_SHORT" }))
      .toBe("Senha muito curta. Use ao menos 8 caracteres.");
  });

  it("falls back to a generic message on unknown codes", () => {
    expect(getAuthErrorMessage({ code: "SOMETHING_WEIRD" }))
      .toBe("Algo deu errado. Tente novamente.");
  });

  it("falls back when input is not an object", () => {
    expect(getAuthErrorMessage(null)).toBe("Algo deu errado. Tente novamente.");
    expect(getAuthErrorMessage("string")).toBe("Algo deu errado. Tente novamente.");
    expect(getAuthErrorMessage(undefined)).toBe("Algo deu errado. Tente novamente.");
  });

  it("uses error.message when no known code is present and message exists", () => {
    expect(getAuthErrorMessage({ message: "rede falhou" }))
      .toBe("rede falhou");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test lib/__tests__/auth-errors.test.ts
```
Expected: failure with `Cannot find module '../auth-errors'`.

- [ ] **Step 3: Implement the helper**

Create `apps/native/lib/auth-errors.ts`:

```ts
const FALLBACK = "Algo deu errado. Tente novamente.";

const CODE_MAP: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com esse email.",
  PASSWORD_TOO_SHORT: "Senha muito curta. Use ao menos 8 caracteres.",
  EMAIL_NOT_VERIFIED: "Confirme seu email antes de entrar.",
  USER_NOT_FOUND: "Não encontramos uma conta com esse email.",
  TOO_MANY_REQUESTS: "Muitas tentativas. Aguarde um instante e tente de novo.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return FALLBACK;

  const code = "code" in error && typeof error.code === "string" ? error.code : null;
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const message = "message" in error && typeof error.message === "string" ? error.message : null;
  if (message && message.length > 0) return message;

  return FALLBACK;
}
```

- [ ] **Step 4: Run the test**

```bash
bun test lib/__tests__/auth-errors.test.ts
```
Expected: all 6 tests pass.

- [ ] **Step 5: Wire into login.tsx**

In `apps/native/app/(auth)/login.tsx`, find the `onSubmit` block (around line 118):

```tsx
const onSubmit = async (data: LoginForm) => {
  setFormError(null);
  const result = await authService.login(data.email.trim(), data.password);
  if (result.error) {
    setFormError(result.error.message || "Não foi possível entrar");
  } else {
    reset();
  }
};
```

Replace with:

```tsx
const onSubmit = async (data: LoginForm) => {
  setFormError(null);
  const result = await authService.login(data.email.trim(), data.password);
  if (result.error) {
    setFormError(getAuthErrorMessage(result.error));
  } else {
    reset();
  }
};
```

Add the import at the top:

```tsx
import { getAuthErrorMessage } from "@/lib/auth-errors";
```

- [ ] **Step 6: Wire into register.tsx**

Apply the same change in `apps/native/app/(auth)/register.tsx`. Find the `onSubmit` handler and replace any inline `result.error.message || "..."` fallback with `getAuthErrorMessage(result.error)`. Add the same import.

- [ ] **Step 7: Run typecheck + all native tests**

```bash
pnpm typecheck && bun test lib/__tests__
```
Expected: typecheck clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/native/lib/auth-errors.ts \
        apps/native/lib/__tests__/auth-errors.test.ts \
        "apps/native/app/(auth)/login.tsx" \
        "apps/native/app/(auth)/register.tsx"
git commit -m "feat(native): map Better-Auth error codes to Portuguese copy"
```

---

## Task 3: Add `confirmDestructiveAction` Helper (TDD)

**Goal:** Provide a Promise-returning wrapper over `Alert.alert` for destructive confirmations (logout now, deletion later).

**Files:**
- Create: `apps/native/lib/ui/confirm.ts`
- Create: `apps/native/lib/__tests__/confirm.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/lib/__tests__/confirm.test.ts`:

```ts
import { afterEach, describe, expect, it, mock } from "bun:test";
import { Alert } from "react-native";
import { confirmDestructiveAction } from "../ui/confirm";

const originalAlert = Alert.alert;

afterEach(() => {
  Alert.alert = originalAlert;
});

function spyAlert(buttonToTap: "Cancel" | "Confirm") {
  const calls: Array<{ title: string; message?: string }> = [];
  Alert.alert = mock((title: string, message?: string, buttons?: any[]) => {
    calls.push({ title, message });
    const target = buttons?.find((b) =>
      buttonToTap === "Confirm" ? b.style === "destructive" : b.style === "cancel"
    );
    target?.onPress?.();
  }) as unknown as typeof Alert.alert;
  return calls;
}

describe("confirmDestructiveAction", () => {
  it("resolves true when destructive button is tapped", async () => {
    spyAlert("Confirm");
    await expect(confirmDestructiveAction("Sair?")).resolves.toBe(true);
  });

  it("resolves false when cancel button is tapped", async () => {
    spyAlert("Cancel");
    await expect(confirmDestructiveAction("Sair?")).resolves.toBe(false);
  });

  it("passes title and optional message to Alert.alert", async () => {
    const calls = spyAlert("Cancel");
    await confirmDestructiveAction("Excluir conta?", "Esta ação é permanente.");
    expect(calls[0]).toEqual({ title: "Excluir conta?", message: "Esta ação é permanente." });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test lib/__tests__/confirm.test.ts
```
Expected: failure with `Cannot find module '../ui/confirm'`.

- [ ] **Step 3: Implement the helper**

Create `apps/native/lib/ui/confirm.ts`:

```ts
import { Alert } from "react-native";

export function confirmDestructiveAction(
  title: string,
  message?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirmar", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
```

- [ ] **Step 4: Run the test**

```bash
bun test lib/__tests__/confirm.test.ts
```
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/native/lib/ui/confirm.ts \
        apps/native/lib/__tests__/confirm.test.ts
git commit -m "feat(native): add confirmDestructiveAction alert helper"
```

---

## Task 4: Wire Sair (Logout) Button on Profile

**Goal:** Add a Sair button on the existing profile screen that confirms, signs out, and clears the query cache. The `AuthGate` will auto-redirect to `/(auth)/login` on the next render.

**Files:**
- Modify: `apps/native/app/(app)/(tabs)/profile.tsx`

(No test for the button itself — it's a thin glue between confirmed-helpers. The integration is verified manually in Task 6.)

- [ ] **Step 1: Read the current profile screen**

```bash
wc -l "apps/native/app/(app)/(tabs)/profile.tsx"
head -20 "apps/native/app/(app)/(tabs)/profile.tsx"
```
Confirm imports and structure. Identify a place near the bottom of the screen for a settings-style row.

- [ ] **Step 2: Add the Sair handler and button**

Add these imports at the top of `profile.tsx`:

```tsx
import { Pressable, Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { confirmDestructiveAction } from "@/lib/ui/confirm";
import { getAuthErrorMessage } from "@/lib/auth-errors";
```

Inside the component, add:

```tsx
const queryClient = useQueryClient();

const onSair = async () => {
  const ok = await confirmDestructiveAction(
    "Sair da conta?",
    "Você precisará entrar novamente."
  );
  if (!ok) return;
  const { error } = await authClient.signOut();
  if (error) {
    Alert.alert("Erro", getAuthErrorMessage(error));
    return;
  }
  queryClient.clear();
};
```

In the JSX, near the bottom of the scrollable content (after the existing profile sections), add:

```tsx
<Pressable
  accessibilityRole="button"
  onPress={onSair}
  className="mx-4 mt-8 mb-12 py-4 rounded-2xl bg-destructive/10 items-center"
>
  <Text className="text-destructive font-semibold text-base">Sair</Text>
</Pressable>
```

(If the existing screen uses `StyleSheet` instead of `className`, mirror that pattern: define a `sairButton` and `sairText` style and apply via `style={...}`.)

- [ ] **Step 3: Verify typecheck**

```bash
cd apps/native && pnpm typecheck
```
Expected: `Found 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add "apps/native/app/(app)/(tabs)/profile.tsx"
git commit -m "feat(native): add Sair logout button to profile"
```

---

## Task 5: Harden `EXPO_PUBLIC_SERVER_URL`

**Goal:** Make the env var required so missing config fails at startup, not at first network call.

**Files:**
- Modify: `packages/env/src/native.ts`
- Create: `packages/env/src/__tests__/native.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/env/src/__tests__/native.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

function loadEnv(envOverride: Record<string, string | undefined>) {
  // Re-import the module under a tweaked process.env to test schema parsing.
  for (const [k, v] of Object.entries(envOverride)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Bust the require cache for a clean re-evaluation.
  const path = require.resolve("../native");
  delete require.cache[path];
  return require("../native");
}

describe("native env", () => {
  it("rejects missing EXPO_PUBLIC_SERVER_URL at parse time", () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_SERVER_URL: undefined })
    ).toThrow();
  });

  it("rejects empty string EXPO_PUBLIC_SERVER_URL", () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_SERVER_URL: "" })
    ).toThrow();
  });

  it("rejects non-URL strings", () => {
    expect(() =>
      loadEnv({ EXPO_PUBLIC_SERVER_URL: "not a url" })
    ).toThrow();
  });

  it("accepts a valid URL", () => {
    const { env } = loadEnv({ EXPO_PUBLIC_SERVER_URL: "http://localhost:3000" });
    expect(env.EXPO_PUBLIC_SERVER_URL).toBe("http://localhost:3000");
  });
});
```

- [ ] **Step 2: Run the test to verify failures (current code is `.optional()`)**

```bash
cd packages/env && bun test
```
Expected: the 3 "rejects" tests fail because the schema still allows `undefined`/`""`. The accept test passes.

- [ ] **Step 3: Tighten the schema**

Modify `packages/env/src/native.ts`. Replace the existing client block:

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_SERVER_URL: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

(Drop `.optional()`. `emptyStringAsUndefined: true` ensures empty strings are treated as missing.)

- [ ] **Step 4: Run the tests**

```bash
bun test
```
Expected: all 4 tests pass.

- [ ] **Step 5: Set the var locally if not already set**

Confirm `apps/native/.env` (or wherever the dev env lives) has `EXPO_PUBLIC_SERVER_URL=http://localhost:3000`. If it doesn't, add it:

```bash
grep EXPO_PUBLIC_SERVER_URL apps/native/.env || echo 'EXPO_PUBLIC_SERVER_URL=http://localhost:3000' >> apps/native/.env
```

- [ ] **Step 6: Verify the native app boots with the required var present**

```bash
cd apps/native && pnpm typecheck
```
Expected: `Found 0 errors.`

(A full Expo boot requires more setup; the typecheck + the test suite are sufficient to confirm the schema works.)

- [ ] **Step 7: Commit**

```bash
git add packages/env/src/native.ts \
        packages/env/src/__tests__/native.test.ts
git commit -m "feat(env): require EXPO_PUBLIC_SERVER_URL at parse time"
```

---

## Task 6: Final Manual Smoke Test

**Goal:** Walk the acceptance criteria from the spec on a real simulator before opening the PR.

**Files:** None modified — verification only.

- [ ] **Step 1: Start the backend**

```bash
cd apps/server && pnpm dev
```
Wait for: `[INFO] Server listening on 3000`. Leave running.

- [ ] **Step 2: Start the simulator**

```bash
cd apps/native && pnpm ios
```
Wait for the app to load.

- [ ] **Step 3: Acceptance walk-through**

Mark each as you confirm:

- [ ] Cold-fresh launch shows a spinner briefly, then the **login screen**.
- [ ] Tap "Não tem conta? Criar conta" → navigates to **register**. Hardware/swipe back → returns to login (not a blank screen).
- [ ] Submit valid signup → lands on `(onboarding)/start`.
- [ ] Force-quit during onboarding → reopen → lands on `(onboarding)/start` again.
- [ ] Complete onboarding (mocked answers OK) → force-quit → reopen → lands on **drawer/tabs home** (not onboarding).
- [ ] Submit invalid login (wrong password) → see Portuguese error: `"Email ou senha incorretos."`
- [ ] Tap **Sair** on profile → see confirmation alert → tap Confirmar → land on login screen.
- [ ] Tap **Sair** on profile → see confirmation alert → tap Cancelar → stay on profile.

- [ ] **Step 4: Confirm env hardening locally**

```bash
cd apps/native && EXPO_PUBLIC_SERVER_URL= pnpm start
```
Expected: build/run **fails** with a Zod validation error about `EXPO_PUBLIC_SERVER_URL`. (Then restore the env var by running normally.)

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feature/auth-ux-completion
```

- [ ] **Step 6: Open a PR**

Use `gh pr create` with title `feat: auth ux completion (Tier 1 #1)` and a body that links to the spec + plan and lists the acceptance checklist above.

---

## Self-Review Notes

Run after writing this plan:

**1. Spec coverage:**
- ✓ Architecture (root-layout gating) — Task 1.
- ✓ Route structure — already exists on phase4; no new task needed (documented in Task 0 branch strategy).
- ✓ Redirect rules table — Task 1, all 9 rows tested.
- ✓ Logout flow — Task 4 (Sair on profile) + Task 3 (confirm helper).
- ✓ Sign-in / sign-up screens — already exist on phase4; getErrorMessage integration in Task 2.
- ✓ Env hardening — Task 5.
- ✓ Loading state — handled inside `getAuthRedirectTarget` ("loading" kind).
- ✓ Error UX — Task 1 (session error) + Task 2 (form errors).
- ✓ Testing — Tasks 1, 2, 3, 5 all TDD; Task 6 manual.

**2. Placeholder scan:** clean — every step has full code or exact commands.

**3. Type consistency:**
- `getAuthRedirectTarget(session, prefs, segments)` signature matches across Task 1 test, implementation, and Task 1 Step 5 caller.
- `getAuthErrorMessage(error: unknown): string` — used identically in login.tsx, register.tsx, profile.tsx.
- `confirmDestructiveAction(title, message?): Promise<boolean>` — matches usage in profile.tsx.

**4. Out-of-scope items respected:**
- No password reset, email verification, Google OAuth, account deletion, or avatar upload tasks.
- Drawer/mais.tsx port is acknowledged as future work (Sair lives interim on profile).
