import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { errorHandlerPlugin } from "./error-handler";
import { NotFoundError } from "../utils/errors";

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
      handler: async (_req, reply) => {
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
