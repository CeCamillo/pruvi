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
