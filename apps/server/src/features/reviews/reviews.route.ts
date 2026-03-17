import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AnswerQuestionBodySchema } from "@pruvi/shared";
import { ReviewsService } from "./reviews.service";
import { ReviewsRepository } from "./reviews.repository";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";

const repo = new ReviewsRepository(db);
const service = new ReviewsService(repo);

export const reviewsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // POST /questions/:questionId/answer
  fastify.post(
    "/questions/:questionId/answer",
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
      schema: {
        params: z.object({
          questionId: z.coerce.number().int().positive(),
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
        selectedOptionIndex
      );
      const response = unwrapResult(result);

      // Invalidate lives and XP caches
      await Promise.all([
        fastify.cache.del(`lives:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
      ]);

      return response;
    }
  );
};
