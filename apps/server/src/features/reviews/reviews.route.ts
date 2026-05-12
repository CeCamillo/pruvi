import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AnswerQuestionBodySchema } from "@pruvi/shared";
import { ReviewsService } from "./reviews.service";
import { ReviewsRepository } from "./reviews.repository";
import { LivesRepository } from "../lives/lives.repository";
import { FriendshipsRepository } from "../social/friendships/friendships.repository";
import { TokensRepository } from "../notifications/tokens.repository";
import { TokensService } from "../notifications/tokens.service";
import { PreferencesRepository } from "../notifications/preferences.repository";
import { SweepRepository } from "../notifications/sweep.repository";
import { Dispatcher } from "../notifications/dispatcher";
import { db } from "@pruvi/db";
import { unwrapResult, successResponse } from "../../types";

export const reviewsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new ReviewsRepository(db);
  const livesRepo = new LivesRepository(db);
  const friendshipsRepo = new FriendshipsRepository(db);
  const tokensRepo = new TokensRepository(db);
  const tokensService = new TokensService(tokensRepo);
  const prefsRepo = new PreferencesRepository(db);
  const sweepRepo = new SweepRepository(db);
  const dispatcher = fastify.queues.notificationsSend
    ? new Dispatcher({
        tokensService,
        prefsRepo,
        sweepRepo,
        sendQueue: fastify.queues.notificationsSend,
      })
    : undefined;
  const service = new ReviewsService(repo, livesRepo, dispatcher, friendshipsRepo, fastify.log);
  // POST /questions/:questionId/answer
  fastify.post(
    "/questions/:questionId/answer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          questionId: z.coerce.number().int(),
        }),
        body: AnswerQuestionBodySchema,
      },
    },
    async (request) => {
      const { questionId } = request.params;
      const { selectedOptionIndex } = request.body;
      const result = await service.answerQuestion(
        request.userId,
        questionId,
        selectedOptionIndex,
      );
      const { answer, cacheTargets } = unwrapResult(result).data;

      // Invalidate lives, XP, progress, mastery, trilha, and topic caches
      await Promise.all([
        fastify.cache.del(`lives:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
        fastify.cache.del(`progress:${request.userId}`),
        fastify.cache.del(`mastery:${request.userId}:all`),
        fastify.cache.del(`mastery:${request.userId}:${cacheTargets.subjectId}`),
        fastify.cache.del(`trilha:${request.userId}:${cacheTargets.subjectId}`),
        fastify.cache.del(`topic:${request.userId}:${cacheTargets.topicId}`),
      ]);

      return successResponse(answer);
    }
  );
};
