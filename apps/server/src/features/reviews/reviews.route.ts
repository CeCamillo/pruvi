import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AnswerQuestionBodySchema } from "@pruvi/shared";
import { ReviewsService } from "./reviews.service";
import { ReviewsRepository } from "./reviews.repository";
import { LivesRepository } from "../lives/lives.repository";
import { db } from "@pruvi/db";
import { unwrapResult, successResponse } from "../../types";

const repo = new ReviewsRepository(db);
const livesRepo = new LivesRepository(db);
const service = new ReviewsService(repo, livesRepo);

export const reviewsRoutes: FastifyPluginAsyncZod = async (fastify) => {
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
