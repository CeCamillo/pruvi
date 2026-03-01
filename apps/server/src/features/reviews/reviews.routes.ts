import type { FastifyInstance } from "fastify";

import { db } from "@pruvi/db";
import { answerRequestSchema } from "@pruvi/shared/questions";

import { recordAnswer } from "./reviews.service";

export function registerReviewsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { id: string }; Body: { selectedOptionIndex: number } }>(
    "/questions/:id/answer",
    async (request, reply) => {
      const questionId = Number(request.params.id);
      if (!Number.isInteger(questionId) || questionId <= 0) {
        return reply.status(400).send({ error: "Invalid question id", code: "VALIDATION_ERROR" });
      }

      const parsed = answerRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body", code: "VALIDATION_ERROR" });
      }

      const result = await recordAnswer(db, {
        userId: request.userId,
        questionId,
        selectedOptionIndex: parsed.data.selectedOptionIndex,
      });

      if (result.isErr()) throw result.error;

      return reply.status(200).send(result.value);
    },
  );
}
