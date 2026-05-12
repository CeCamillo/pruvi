import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StartSessionBodySchema } from "@pruvi/shared";
import { SessionsService } from "./sessions.service";
import { SessionsRepository } from "./sessions.repository";
import { QuestionsRepository } from "../questions/questions.repository";
import { QuestionsService } from "../questions/questions.service";
import { TopicsRepository } from "../topics/topics.repository";
import { TopicsService } from "../topics/topics.service";
import { TokensRepository } from "../notifications/tokens.repository";
import { TokensService } from "../notifications/tokens.service";
import { PreferencesRepository } from "../notifications/preferences.repository";
import { SweepRepository } from "../notifications/sweep.repository";
import { Dispatcher } from "../notifications/dispatcher";
import { StreaksRepository } from "../streaks/streaks.repository";
import { StreaksService } from "../streaks/streaks.service";
import { ShieldsRepository } from "../shields/shields.repository";
import { ShieldsService } from "../shields/shields.service";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const SESSION_CACHE_TTL = 30; // 30 seconds

export const sessionsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const sessionsRepo = new SessionsRepository(db);
  const questionsRepo = new QuestionsRepository(db);
  const questionsService = new QuestionsService(questionsRepo);
  const topicsRepo = new TopicsRepository(db);
  const topicsService = new TopicsService(topicsRepo);
  const tokensRepo = new TokensRepository(db);
  const tokensService = new TokensService(tokensRepo);
  const prefsRepo = new PreferencesRepository(db);
  const sweepRepo = new SweepRepository(db);
  const streaksRepo = new StreaksRepository(db);
  const streaksService = new StreaksService(streaksRepo);
  const shieldsRepo = new ShieldsRepository(db);
  const shieldsService = new ShieldsService(shieldsRepo);
  const dispatcher = fastify.queues.notificationsSend
    ? new Dispatcher({
        tokensService,
        prefsRepo,
        sweepRepo,
        sendQueue: fastify.queues.notificationsSend,
      })
    : null;
  const service = new SessionsService(
    sessionsRepo,
    questionsService,
    topicsService,
    streaksService,
    dispatcher,
    shieldsService,
    fastify.log,
  );
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
      const { mode, topicId } = request.body;

      // Check for pre-generated questions in Redis (already stripped of correctOptionIndex)
      const prefetchKey = `prefetch:${request.userId}`;
      const cachedQuestions = await fastify.cache.get<Array<{ subtopicId: number }>>(prefetchKey);
      const prefetchedSubtopicIds = cachedQuestions
        ? Array.from(new Set(cachedQuestions.map((q) => q.subtopicId)))
        : undefined;

      const result = await service.startSession(
        request.userId,
        mode,
        !!cachedQuestions,
        topicId,
        prefetchedSubtopicIds,
      );
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

      const cached = await fastify.cache.get<{ session: unknown }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getTodaySession(request.userId);
      const session = unwrapResult(result).data;
      const payload = { session };

      await fastify.cache.set(cacheKey, payload, SESSION_CACHE_TTL);

      return successResponse(payload);
    }
  );

  // POST /sessions/:id/complete
  fastify.post(
    "/sessions/:id/complete",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.coerce.number().int(),
        }),
        body: z
          .object({
            questionsAnswered: z.number().int().min(0),
            questionsCorrect: z.number().int().min(0),
          })
          .refine((data) => data.questionsCorrect <= data.questionsAnswered, {
            message: "questionsCorrect cannot exceed questionsAnswered",
            path: ["questionsCorrect"],
          }),
      },
    },
    async (request) => {
      const { id } = request.params;
      const { questionsAnswered, questionsCorrect } = request.body;
      const result = await service.completeSession(
        request.userId,
        id,
        questionsAnswered,
        questionsCorrect
      );
      const { session, transitions } = unwrapResult(result).data;

      // Invalidate caches that depend on session completion.
      // `shields:` is invalidated unconditionally: if the auto-use hook fires (fire-and-forget),
      // the shield balance changed; if it doesn't fire, the del is a cheap no-op.
      await Promise.all([
        fastify.cache.del(`session-today:${request.userId}`),
        fastify.cache.del(`streaks:${request.userId}`),
        fastify.cache.del(`shields:${request.userId}`),
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

      return successResponse({ session, transitions });
    }
  );
};
