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
      const response = unwrapResult(result);

      // Invalidate lives, XP, progress, and subject-specific review caches
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
      await Promise.all(invalidations);

      return response;
    },
  );
};
