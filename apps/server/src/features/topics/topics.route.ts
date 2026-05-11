import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { TopicsRepository } from "./topics.repository";
import { TopicsService } from "./topics.service";

const repo = new TopicsRepository(db);
const service = new TopicsService(repo);

const TRILHA_TTL = 300;
const TOPIC_TTL = 300;
const MASTERY_TTL = 300;

export const topicsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/subjects/:subjectId/trilha",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ subjectId: z.coerce.number().int().positive() }),
      },
    },
    async (request) => {
      const { subjectId } = request.params;
      const cacheKey = `trilha:${request.userId}:${subjectId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.getTrilha(request.userId, subjectId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, TRILHA_TTL);
      return response;
    },
  );

  fastify.get(
    "/topics/:topicId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ topicId: z.coerce.number().int().positive() }),
      },
    },
    async (request) => {
      const { topicId } = request.params;
      const cacheKey = `topic:${request.userId}:${topicId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.getTopicDetail(request.userId, topicId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, TOPIC_TTL);
      return response;
    },
  );

  fastify.get(
    "/users/me/mastery",
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: z.object({
          subjectId: z.coerce.number().int().positive().optional(),
        }),
      },
    },
    async (request) => {
      const subjectId = request.query.subjectId ?? null;
      const cacheKey = `mastery:${request.userId}:${subjectId ?? "all"}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.getUserMastery(request.userId, subjectId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, MASTERY_TTL);
      return response;
    },
  );
};
