import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StreaksService } from "./streaks.service";
import { StreaksRepository } from "./streaks.repository";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const repo = new StreaksRepository(db);
const service = new StreaksService(repo);

const CACHE_TTL = 60; // 60 seconds — streaks change once per day

export const streaksRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /streaks
  fastify.get(
    "/streaks",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `streaks:${request.userId}`;

      const cached = await fastify.cache.get<{
        currentStreak: number;
        longestStreak: number;
        totalSessions: number;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getStreaks(request.userId);
      const response = unwrapResult(result);

      await fastify.cache.set(cacheKey, response.data, CACHE_TTL);

      return response;
    }
  );
};
