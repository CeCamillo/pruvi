import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StartSessionBodySchema } from "@pruvi/shared";
import { SessionsService } from "./sessions.service";
import { SessionsRepository } from "./sessions.repository";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const repo = new SessionsRepository(db);
const service = new SessionsService(repo);

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
      const result = await service.startSession(request.userId, mode);
      const { session, questions } = unwrapResult(result).data;

      // Strip correctOptionIndex from questions before sending to client
      const safeQuestions = questions.map(
        ({ correctOptionIndex: _, ...q }) => q
      );

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
      const result = await service.getTodaySession(request.userId);
      return unwrapResult(result);
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
      return unwrapResult(result);
    }
  );
};
