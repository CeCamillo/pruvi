import fastifyCompress from "@fastify/compress";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { auth } from "@pruvi/auth";
import { pool } from "@pruvi/db";
import { env } from "@pruvi/env/server";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { gamificationRoutes } from "./features/gamification";
import { livesRoutes } from "./features/lives";
import { reviewsRoutes } from "./features/reviews";
import { sessionsRoutes } from "./features/sessions";
import { streaksRoutes } from "./features/streaks";
import { usersRoutes } from "./features/users";
import { authPlugin } from "./plugins/auth";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { queuePlugin } from "./plugins/queue";
import { redisPlugin } from "./plugins/redis";
import { startSessionPrefetchWorker } from "./workers/session-prefetch.worker";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
      ],
    },
    bodyLimit: 1_048_576, // 1MB
  });

  // Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Plugins
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // API-only server, no HTML
  });
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400,
  });
  await app.register(fastifyCompress);
  await app.register(errorHandlerPlugin);
  await app.register(redisPlugin);
  await app.register(queuePlugin);
  await app.register(authPlugin);

  // Auth catch-all (Better Auth handler) — strict rate limit for brute-force protection
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" },
    },
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

  // Feature routes
  await app.register(sessionsRoutes);
  await app.register(reviewsRoutes);
  await app.register(livesRoutes);
  await app.register(streaksRoutes);
  await app.register(gamificationRoutes);
  await app.register(usersRoutes);

  // Health check — verifies DB connectivity for ALB
  app.get("/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { success: true, data: "OK" };
    } catch {
      return reply.status(503).send({
        success: false,
        error: "Database unavailable",
        code: "HEALTH_CHECK_FAILED",
      });
    }
  });

  return app;
}

// Start server when run directly (not imported for testing)
// Bun provides import.meta.main for this purpose
if (import.meta.main) {
  const app = await buildApp();
  const prefetchWorker = startSessionPrefetchWorker();
  app.addHook("onClose", async () => {
    await prefetchWorker?.cleanup();
  });
  app.listen({ port: env.PORT, host: "0.0.0.0" }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
}
