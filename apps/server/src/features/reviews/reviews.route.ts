import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AnswerQuestionBodySchema } from "@pruvi/shared";
import { ReviewsService } from "./reviews.service";
import { ReviewsRepository } from "./reviews.repository";
import { SessionsRepository } from "../sessions/sessions.repository";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";

const repo = new ReviewsRepository(db);
const sessionsRepo = new SessionsRepository(db);
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
    async (request, reply) => {
      const { questionId } = request.params;
      const { selectedOptionIndex } = request.body;

      // Verify user has an active session and this question belongs to it
      const activeSession = await sessionsRepo.findTodaySession(request.userId);
      if (!activeSession || activeSession.status !== "active") {
        return reply.status(403).send({
          success: false,
          error: "No active session. Start a session first.",
          code: "NO_ACTIVE_SESSION",
        });
      }

      const isInSession = await fastify.cache.sismember(
        `session-questions:${activeSession.id}`,
        questionId
      );
      if (!isInSession) {
        return reply.status(403).send({
          success: false,
          error: "Question not part of your current session.",
          code: "QUESTION_NOT_IN_SESSION",
        });
      }

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
