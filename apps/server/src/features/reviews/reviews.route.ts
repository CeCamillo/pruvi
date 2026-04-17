import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AnswerQuestionBodySchema } from "@pruvi/shared";
import { ReviewsService } from "./reviews.service";
import { ReviewsRepository } from "./reviews.repository";
import { QuestionsRepository } from "../questions/questions.repository";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";

const repo = new ReviewsRepository(db);
const questionsRepo = new QuestionsRepository(db);
const service = new ReviewsService(repo);

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

      // Invalidate BEFORE unwrapping the result: even the error path
      // (e.g., ValidationError when lives hit 0) may have already
      // mutated lives / XP / review_log, so the caches must be dropped
      // regardless of success or failure. Cache failures are swallowed
      // and logged — stale cache self-heals via TTL, but losing the
      // answer result to a Redis blip would be user-visible.
      try {
        const slug = await questionsRepo.getSubjectSlugForQuestion(questionId);
        const invalidations: Promise<unknown>[] = [
          fastify.cache.del(`lives:${request.userId}`),
          fastify.cache.del(`xp:${request.userId}`),
          fastify.cache.del(`progress:${request.userId}`),
        ];
        if (slug) {
          invalidations.push(
            fastify.cache.del(`subject-reviews:${request.userId}:${slug}`),
          );
        }
        await Promise.allSettled(invalidations);
      } catch (err) {
        fastify.log.warn(
          { err, userId: request.userId, questionId },
          "answer cache invalidation failed",
        );
      }

      return unwrapResult(result);
    },
  );
};
