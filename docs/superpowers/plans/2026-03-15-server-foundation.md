# Server Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the server infrastructure every feature module needs — AppError hierarchy, Fastify Zod type provider, error handling plugin, auth middleware, and the consistent `{ success, data?, error? }` response format.

**Architecture:** Fastify 5 with `fastify-type-provider-zod` for schema-validated routes, `neverthrow` for typed Result returns from services, a custom `AppError` class hierarchy mapped to HTTP status codes, and a Fastify plugin that catches both AppErrors and Zod validation errors. Auth middleware extracts the Better Auth session and decorates the request with `userId`.

**Tech Stack:** Fastify 5, fastify-type-provider-zod, neverthrow, Zod 4, Better Auth, Pino (built into Fastify)

---

## Chunk 1: Dependencies & AppError Hierarchy

### Task 1: Install dependencies

**Files:**
- Modify: `apps/server/package.json`
- Modify: `pnpm-workspace.yaml` (add neverthrow to catalog)

- [ ] **Step 1: Add neverthrow to the pnpm catalog**

In `pnpm-workspace.yaml`, add `neverthrow` to the catalog:

```yaml
catalog:
  dotenv: ^17.2.2
  zod: ^4.1.13
  typescript: ^5
  "@types/bun": ^1.3.4
  better-auth: 1.5.2
  "@better-auth/expo": 1.5.2
  vitest: ^3.0.0
  neverthrow: ^8.2.0
```

- [ ] **Step 2: Install server dependencies**

```bash
cd apps/server && pnpm add fastify-type-provider-zod fastify-plugin neverthrow@catalog:
cd apps/server && pnpm add -D vitest@catalog:
```

Note: `fastify-plugin` is needed for breaking Fastify encapsulation in plugins.

- [ ] **Step 3: Add test script to server package.json**

Add `"test": "vitest run"` to the `scripts` section in `apps/server/package.json`.

- [ ] **Step 4: Create vitest config for server**

Create `apps/server/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Install shared dependency**

```bash
cd packages/shared && pnpm add neverthrow@catalog:
```

- [ ] **Step 6: Verify installation**

```bash
pnpm install && pnpm run check-types
```

Expected: no errors, all packages in node_modules.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml apps/server/package.json apps/server/vitest.config.ts packages/shared/package.json pnpm-lock.yaml
git commit -m "chore(server): add fastify-type-provider-zod, neverthrow, and vitest"
```

---

### Task 2: AppError class hierarchy

**Files:**
- Create: `apps/server/src/utils/errors.ts`
- Test: `apps/server/src/utils/errors.test.ts`

The `AppError` hierarchy maps domain errors to HTTP status codes. Services throw these; the error handler plugin catches them.

- [ ] **Step 1: Write failing tests for AppError hierarchy**

Create `apps/server/src/utils/errors.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  AppError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./errors";

describe("AppError", () => {
  it("creates an error with message, statusCode, and code", () => {
    const error = new AppError("something broke", 500, "INTERNAL_ERROR");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("something broke");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.name).toBe("AppError");
  });
});

describe("NotFoundError", () => {
  it("defaults to 404 and NOT_FOUND code", () => {
    const error = new NotFoundError("user not found");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.name).toBe("NotFoundError");
  });
});

describe("ValidationError", () => {
  it("defaults to 400 and VALIDATION_ERROR code", () => {
    const error = new ValidationError("invalid email");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
  });
});

describe("UnauthorizedError", () => {
  it("defaults to 401 and UNAUTHORIZED code", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Unauthorized");
  });
});

describe("ForbiddenError", () => {
  it("defaults to 403 and FORBIDDEN code", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });
});

describe("DatabaseError", () => {
  it("defaults to 500 and DATABASE_ERROR code", () => {
    const error = new DatabaseError("connection failed");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("DATABASE_ERROR");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm vitest run src/utils/errors.test.ts
```

Expected: FAIL — module `./errors` not found.

- [ ] **Step 3: Implement AppError hierarchy**

Create `apps/server/src/utils/errors.ts`:

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation error") {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database error") {
    super(message, 500, "DATABASE_ERROR");
    this.name = "DatabaseError";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && pnpm vitest run src/utils/errors.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Update utils barrel export**

Replace `apps/server/src/utils/index.ts`:

```typescript
export * from "./errors";
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/utils/errors.ts apps/server/src/utils/errors.test.ts apps/server/src/utils/index.ts apps/server/package.json
git commit -m "feat(server): add AppError class hierarchy with tests"
```

---

## Chunk 2: Error Handler Plugin & Zod Type Provider

### Task 3: Error handler Fastify plugin

**Files:**
- Create: `apps/server/src/plugins/error-handler.ts`
- Test: `apps/server/src/plugins/error-handler.test.ts`

This plugin sets Fastify's `setErrorHandler` to catch `AppError` instances, Zod validation errors (from the type provider), and unexpected errors. All responses follow `{ success: boolean, error?: string }`.

- [ ] **Step 1: Write failing tests for the error handler plugin**

Create `apps/server/src/plugins/error-handler.test.ts`:

```typescript
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { errorHandlerPlugin } from "./error-handler";
import { AppError, NotFoundError, ValidationError } from "../utils/errors";

function buildApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(errorHandlerPlugin);
  return app;
}

describe("errorHandlerPlugin", () => {
  it("catches AppError and returns structured response", async () => {
    const app = buildApp();
    app.get("/", async () => {
      throw new NotFoundError("user not found");
    });

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      success: false,
      error: "user not found",
      code: "NOT_FOUND",
    });
  });

  it("catches Zod validation errors from schema", async () => {
    const app = buildApp();
    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/",
      schema: {
        body: z.object({ name: z.string().min(3) }),
      },
      handler: async (req, reply) => {
        reply.send({ success: true });
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/",
      payload: { name: "ab" },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("catches unexpected errors as 500 without exposing internals", async () => {
    const app = buildApp();
    app.get("/", async () => {
      throw new Error("secret database credentials leaked");
    });

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("secret");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm vitest run src/plugins/error-handler.test.ts
```

Expected: FAIL — module `./error-handler` exports nothing.

- [ ] **Step 3: Implement the error handler plugin**

Create `apps/server/src/plugins/error-handler.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError } from "../utils/errors";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Zod schema validation errors (from type provider)
    if (hasZodFastifySchemaValidationErrors(error)) {
      request.log.warn({ err: error }, "Validation error");
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
      });
    }

    // Known application errors
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error }, error.message);
      } else {
        request.log.warn({ err: error }, error.message);
      }
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Unexpected errors — never expose internals
    request.log.error({ err: error }, "Unhandled error");
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });
};

export const errorHandlerPlugin = fp(plugin, {
  name: "error-handler",
});
```

Note: `fastify-plugin` (`fp`) breaks Fastify's encapsulation so the error handler applies globally. It was installed in Task 1.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && pnpm vitest run src/plugins/error-handler.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Update plugins barrel export**

Replace `apps/server/src/plugins/index.ts`:

```typescript
export { errorHandlerPlugin } from "./error-handler";
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/plugins/error-handler.ts apps/server/src/plugins/error-handler.test.ts apps/server/src/plugins/index.ts apps/server/package.json
git commit -m "feat(server): add error handler plugin with Zod + AppError support"
```

---

### Task 4: Wire Zod type provider and error handler into the server

**Files:**
- Modify: `apps/server/src/index.ts`

Refactor the server entrypoint to use Zod type provider globally, register the error handler plugin, and export a `buildApp` function for testability.

- [ ] **Step 1: Write a smoke test for the server setup**

Create `apps/server/src/index.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

// Mock env and auth — they require DATABASE_URL and a real DB connection at import time
vi.mock("@pruvi/env/server", () => ({
  env: {
    CORS_ORIGIN: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));
vi.mock("@pruvi/auth", () => ({
  auth: {
    handler: vi.fn(),
    api: { getSession: vi.fn() },
  },
}));

import { buildApp } from "./index";

describe("server", () => {
  it("returns OK on health check", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: "OK" });
  });

  it("returns 404 for unknown routes", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/nonexistent" });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/server && pnpm vitest run src/index.test.ts
```

Expected: FAIL — `buildApp` not exported.

- [ ] **Step 3: Refactor index.ts — extract buildApp**

Rewrite `apps/server/src/index.ts`:

```typescript
import fastifyCors from "@fastify/cors";
import { auth } from "@pruvi/auth";
import { env } from "@pruvi/env/server";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { errorHandlerPlugin } from "./plugins/error-handler";

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Plugins
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400,
  });
  await app.register(errorHandlerPlugin);

  // Auth catch-all (Better Auth handler)
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) headers.append(key, String(value));
      }
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    },
  });

  // Health check
  app.get("/health", async () => {
    return { success: true, data: "OK" };
  });

  return app;
}

// Start server when run directly (not imported for testing)
// Bun provides import.meta.main for this purpose
if (import.meta.main) {
  const app = await buildApp();
  app.listen({ port: 3000 }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && pnpm vitest run src/index.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/index.ts apps/server/src/index.test.ts
git commit -m "refactor(server): extract buildApp with Zod type provider and error handler"
```

---

## Chunk 3: Auth Middleware & Response Types

### Task 5: Auth middleware plugin

**Files:**
- Create: `apps/server/src/plugins/auth.ts`
- Test: `apps/server/src/plugins/auth.test.ts`

This plugin provides an `authenticate` onRequest hook that extracts the Better Auth session from the request, attaches `userId` to the request, and returns 401 if no valid session.

- [ ] **Step 1: Write failing tests for auth middleware**

Create `apps/server/src/plugins/auth.test.ts`:

```typescript
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { authPlugin } from "./auth";

// Mock Better Auth's fromNodeHeaders
vi.mock("better-auth/node", () => ({
  fromNodeHeaders: vi.fn((headers: Record<string, string | string[] | undefined>) => headers),
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
  return app;
}

describe("authPlugin", () => {
  it("attaches userId to request when session is valid", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: "user-123" },
      session: {},
    } as never);

    const app = buildApp();
    // Must await ready() before accessing app.authenticate — plugins register lazily
    await app.ready();
    app.get("/", { preHandler: [app.authenticate] }, async (request) => {
      return { userId: request.userId };
    });

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
    app.get("/", { preHandler: [app.authenticate] }, async (request) => {
      return { userId: request.userId };
    });

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm vitest run src/plugins/auth.test.ts
```

Expected: FAIL — `authPlugin` not exported.

- [ ] **Step 3: Install better-auth/node dependency (already bundled with better-auth)**

`fromNodeHeaders` is exported from `better-auth/node`. No separate install needed — it ships with the `better-auth` package.

- [ ] **Step 4: Implement auth plugin**

Create `apps/server/src/plugins/auth.ts`:

```typescript
import { auth } from "@pruvi/auth";
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import { fromNodeHeaders } from "better-auth/node";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.decorateRequest("userId", "");

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        });
      }

      request.userId = session.user.id;
    }
  );
};

export const authPlugin = fp(plugin, {
  name: "auth",
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/server && pnpm vitest run src/plugins/auth.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Update plugins barrel and register in buildApp**

Update `apps/server/src/plugins/index.ts`:

```typescript
export { errorHandlerPlugin } from "./error-handler";
export { authPlugin } from "./auth";
```

Update `apps/server/src/index.ts` to register the auth plugin after errorHandlerPlugin:

```typescript
import { authPlugin } from "./plugins/auth";

// In buildApp(), after registering errorHandlerPlugin:
await app.register(authPlugin);
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/plugins/auth.ts apps/server/src/plugins/auth.test.ts apps/server/src/plugins/index.ts apps/server/src/index.ts
git commit -m "feat(server): add auth middleware plugin with session extraction"
```

---

### Task 6: Shared response types

**Files:**
- Modify: `apps/server/src/types/index.ts`
- Test: `apps/server/src/types/types.test.ts`

Define the consistent API response format used across all routes.

- [ ] **Step 1: Write failing tests for response helpers**

Create `apps/server/src/types/types.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ok, err } from "neverthrow";
import { successResponse, unwrapResult } from "./index";

describe("successResponse", () => {
  it("wraps data in a success envelope", () => {
    const result = successResponse({ id: 1, name: "test" });
    expect(result).toEqual({
      success: true,
      data: { id: 1, name: "test" },
    });
  });
});

describe("unwrapResult", () => {
  it("returns success response for Ok result", () => {
    const result = ok("hello");
    expect(unwrapResult(result)).toEqual({
      success: true,
      data: "hello",
    });
  });

  it("throws the error for Err result", () => {
    const error = new Error("something went wrong");
    const result = err(error);
    expect(() => unwrapResult(result)).toThrow("something went wrong");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm vitest run src/types/types.test.ts
```

Expected: FAIL — `successResponse` and `unwrapResult` not defined.

- [ ] **Step 3: Implement response types**

Replace `apps/server/src/types/index.ts`:

```typescript
import type { Result } from "neverthrow";

/** Standard API success response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

/** Union type for all API responses */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Helper to create success responses */
export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}

/**
 * Unwrap a neverthrow Result into an API response.
 * Ok values become { success: true, data }.
 * Err values throw the AppError (caught by errorHandlerPlugin).
 */
export function unwrapResult<T, E extends Error>(result: Result<T, E>): ApiSuccessResponse<T> {
  if (result.isOk()) {
    return successResponse(result.value);
  }
  throw result.error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/server && pnpm vitest run src/types/types.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Verify types compile**

```bash
cd apps/server && pnpm run check-types
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/types/index.ts apps/server/src/types/types.test.ts
git commit -m "feat(server): add API response types and Result unwrap helper"
```

---

## Chunk 4: Integration Test — Full Round Trip

### Task 7: End-to-end integration test

**Files:**
- Create: `apps/server/src/integration.test.ts`

Verify everything works together: Zod validation error → structured response, AppError → structured response, health check → success response.

- [ ] **Step 1: Write integration test**

Create `apps/server/src/integration.test.ts`:

```typescript
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { NotFoundError } from "./utils/errors";
import { successResponse } from "./types";

function buildTestApp() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(errorHandlerPlugin);
  return app;
}

describe("server integration", () => {
  it("validates request body with Zod and returns structured error", async () => {
    const app = buildTestApp();
    app.withTypeProvider<ZodTypeProvider>().post(
      "/test",
      {
        schema: {
          body: z.object({
            email: z.email(),
            age: z.number().min(16).max(100),
          }),
        },
      },
      async (req) => successResponse(req.body)
    );

    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: { email: "not-an-email", age: 5 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
    expect(res.json().code).toBe("VALIDATION_ERROR");
  });

  it("returns typed success response from valid request", async () => {
    const app = buildTestApp();
    app.withTypeProvider<ZodTypeProvider>().post(
      "/test",
      {
        schema: {
          body: z.object({
            email: z.email(),
            age: z.number().min(16).max(100),
          }),
        },
      },
      async (req) => successResponse(req.body)
    );

    const res = await app.inject({
      method: "POST",
      url: "/test",
      payload: { email: "test@example.com", age: 18 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      data: { email: "test@example.com", age: 18 },
    });
  });

  it("catches AppError and returns structured response", async () => {
    const app = buildTestApp();
    app.get("/missing", async () => {
      throw new NotFoundError("resource not found");
    });

    const res = await app.inject({ method: "GET", url: "/missing" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      success: false,
      error: "resource not found",
      code: "NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
cd apps/server && pnpm vitest run src/integration.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 3: Run all server tests**

```bash
cd apps/server && pnpm vitest run
```

Expected: All tests pass (errors, error-handler, auth, index, integration).

- [ ] **Step 4: Run type check across monorepo**

```bash
pnpm run check-types
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/integration.test.ts
git commit -m "test(server): add integration tests for error handling and Zod validation"
```

---

## Summary

After completing all tasks, the server will have:

| Component | File | Purpose |
|---|---|---|
| AppError hierarchy | `src/utils/errors.ts` | Domain errors mapped to HTTP status codes |
| Error handler plugin | `src/plugins/error-handler.ts` | Catches AppError + Zod errors → structured response |
| Auth plugin | `src/plugins/auth.ts` | Extracts Better Auth session → `request.userId` |
| Response types | `src/types/index.ts` | `ApiResponse<T>`, `successResponse()`, `unwrapResult()` |
| Server factory | `src/index.ts` | `buildApp()` with Zod type provider + plugins |

Every feature module (sessions, reviews, lives, streaks, questions) can now:
1. Define routes with Zod schemas for compile-time + runtime type safety
2. Call services that return `Result<T, AppError>` via neverthrow
3. Use `unwrapResult()` to convert Results into API responses
4. Use `app.authenticate` as a preHandler for protected routes
5. Throw `AppError` subclasses and get consistent error responses
