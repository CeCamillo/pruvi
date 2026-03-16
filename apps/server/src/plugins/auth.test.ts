import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { authPlugin } from "./auth";

// Mock Better Auth's fromNodeHeaders
vi.mock("better-auth/node", () => ({
  fromNodeHeaders: vi.fn(
    (headers: Record<string, string | string[] | undefined>) => headers
  ),
}));

// Mock @pruvi/auth
vi.mock("@pruvi/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { auth } from "@pruvi/auth";

function buildApp() {
  const app = Fastify();
  app.register(authPlugin);

  // Routes must be defined before ready() — use app.after() to ensure
  // the plugin's decorators are available when the route is being set up
  app.after(() => {
    app.get("/", { preHandler: [app.authenticate] }, async (request) => {
      return { userId: request.userId };
    });
  });

  return app;
}

describe("authPlugin", () => {
  it("attaches userId to request when session is valid", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: "user-123" },
      session: {},
    } as never);

    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { authorization: "Bearer token" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBe("user-123");
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never);

    const app = buildApp();
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(401);
  });
});
