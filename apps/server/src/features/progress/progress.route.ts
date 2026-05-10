import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CalendarQuerySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { ProgressRepository } from "./progress.repository";
import { ProgressService } from "./progress.service";
import { successResponse, unwrapResult } from "../../types";

const repo = new ProgressRepository(db);
const service = new ProgressService(repo);

const PROGRESS_CACHE_TTL = 300;
const CALENDAR_CACHE_TTL = 60;

export const progressRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/progress",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const cacheKey = `progress:${request.userId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.getProgress(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PROGRESS_CACHE_TTL);
      return response;
    }
  );

  fastify.get(
    "/users/me/calendar",
    {
      preHandler: [fastify.authenticate],
      schema: { querystring: CalendarQuerySchema },
    },
    async (request) => {
      const { from, to } = request.query;
      const cacheKey = `calendar:${request.userId}:${from}:${to}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.getCalendar(request.userId, from, to);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, CALENDAR_CACHE_TTL);
      return response;
    }
  );
};
