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
