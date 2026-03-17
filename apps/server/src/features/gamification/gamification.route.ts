import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { GamificationService } from "./gamification.service";
import { GamificationRepository } from "./gamification.repository";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const repo = new GamificationRepository(db);
const service = new GamificationService(repo);

const CACHE_TTL = 60; // 60 seconds

export const gamificationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/xp
  fastify.get(
    "/users/me/xp",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `xp:${request.userId}`;

      const cached = await fastify.cache.get<{
        totalXp: number;
        currentLevel: number;
        xpForNextLevel: number;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getXp(request.userId);
      const response = unwrapResult(result);

      await fastify.cache.set(cacheKey, response.data, CACHE_TTL);

      return response;
    }
  );
};
