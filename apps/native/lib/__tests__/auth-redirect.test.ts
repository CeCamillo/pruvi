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
