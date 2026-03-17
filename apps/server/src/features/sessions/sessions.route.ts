import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StartSessionBodySchema } from "@pruvi/shared";
import { SessionsService } from "./sessions.service";
import { SessionsRepository } from "./sessions.repository";
import { QuestionsRepository } from "../questions/questions.repository";
import { QuestionsService } from "../questions/questions.service";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const sessionsRepo = new SessionsRepository(db);
const questionsRepo = new QuestionsRepository(db);
const questionsService = new QuestionsService(questionsRepo);
const service = new SessionsService(sessionsRepo, questionsService);

const SESSION_CACHE_TTL = 30; // 30 seconds

export const sessionsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /sessions/start
  fastify.post(
    "/sessions/start",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: StartSessionBodySchema,
      },
    },
    async (request) => {
      const { mode } = request.body;

      // Check for pre-generated questions in Redis (already stripped of correctOptionIndex)
      const prefetchKey = `prefetch:${request.userId}`;
      const cachedQuestions = await fastify.cache.get<unknown[]>(prefetchKey);

      const result = await service.startSession(request.userId, mode, !!cachedQuestions);
      const { session, questions } = unwrapResult(result).data;

      // If cache hit, use cached questions; otherwise strip correctOptionIndex from DB results
      const safeQuestions = cachedQuestions ?? questions.map(
        ({ correctOptionIndex: _, ...q }) => q
      );

      // Invalidate caches
      await Promise.all([
        fastify.cache.del(`session-today:${request.userId}`),
        fastify.cache.del(prefetchKey),
      ]);

      return successResponse({ session, questions: safeQuestions });
    }
  );

  // GET /sessions/today
  fastify.get(
    "/sessions/today",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `session-today:${request.userId}`;

      const cached = await fastify.cache.get(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getTodaySession(request.userId);
      const response = unwrapResult(result);

      await fastify.cache.set(cacheKey, response.data, SESSION_CACHE_TTL);

      return response;
    }
  );

  // POST /sessions/:id/complete
  fastify.post(
    "/sessions/:id/complete",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive(),
        }),
        body: z.object({
          questionCount: z.number().int().min(0),
          correctCount: z.number().int().min(0),
        }),
      },
    },
    async (request) => {
      const { id } = request.params;
      const { questionCount, correctCount } = request.body;
      const result = await service.completeSession(
        request.userId,
        id,
        questionCount,
        correctCount
      );
      const response = unwrapResult(result);

      // Invalidate caches that depend on session completion
      await Promise.all([
        fastify.cache.del(`session-today:${request.userId}`),
        fastify.cache.del(`streaks:${request.userId}`),
      ]);

      // Enqueue next session pre-generation
      if (fastify.queues.sessionPrefetch) {
        await fastify.queues.sessionPrefetch.add(
          `prefetch-${request.userId}`,
          { userId: request.userId, mode: "all" },
          {
            removeOnComplete: true,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
          }
        );
      }

      return response;
    }
  );
};
