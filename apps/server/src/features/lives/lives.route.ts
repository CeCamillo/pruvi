import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { LivesService } from "./lives.service";
import { LivesRepository } from "./lives.repository";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const repo = new LivesRepository(db);
const service = new LivesService(repo);

const CACHE_TTL = 30; // 30 seconds

export const livesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/lives
  fastify.get(
    "/users/me/lives",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `lives:${request.userId}`;

      // Check cache
      const cached = await fastify.cache.get<{
        lives: number;
        maxLives: number;
        resetsAt: string | null;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      // Cache miss — query DB
      const result = await service.getLives(request.userId);
      const response = unwrapResult(result);

      // Cache the result
      await fastify.cache.set(cacheKey, response.data, CACHE_TTL);

      return response;
    }
  );
};
