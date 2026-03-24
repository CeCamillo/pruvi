import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { eq } from "drizzle-orm";
import { successResponse } from "../../types";

export const devRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /dev/reset/lives — reset lives to 5
  fastify.post(
    "/dev/reset/lives",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      await db
        .update(user)
        .set({ lives: 5, livesResetAt: null })
        .where(eq(user.id, request.userId));

      await fastify.cache.del(`lives:${request.userId}`);
      return successResponse({ reset: "lives", lives: 5 });
    }
  );

  // POST /dev/reset/xp — reset XP and level
  fastify.post(
    "/dev/reset/xp",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      await db
        .update(user)
        .set({ totalXp: 0, currentLevel: 1 })
        .where(eq(user.id, request.userId));

      await fastify.cache.del(`xp:${request.userId}`);
      return successResponse({ reset: "xp", totalXp: 0, currentLevel: 1 });
    }
  );

  // POST /dev/reset/sessions — delete all sessions and review logs
  fastify.post(
    "/dev/reset/sessions",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      await db.delete(reviewLog).where(eq(reviewLog.userId, request.userId));
      await db.delete(dailySession).where(eq(dailySession.userId, request.userId));

      await Promise.all([
        fastify.cache.del(`session-today:${request.userId}`),
        fastify.cache.del(`streaks:${request.userId}`),
      ]);
      return successResponse({ reset: "sessions" });
    }
  );

  // POST /dev/reset/all — full reset
  fastify.post(
    "/dev/reset/all",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      await db.delete(reviewLog).where(eq(reviewLog.userId, request.userId));
      await db.delete(dailySession).where(eq(dailySession.userId, request.userId));
      await db
        .update(user)
        .set({ lives: 5, livesResetAt: null, totalXp: 0, currentLevel: 1 })
        .where(eq(user.id, request.userId));

      // Clear all caches for this user
      await Promise.all([
        fastify.cache.del(`lives:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
        fastify.cache.del(`session-today:${request.userId}`),
        fastify.cache.del(`streaks:${request.userId}`),
      ]);
      return successResponse({ reset: "all" });
    }
  );
};
