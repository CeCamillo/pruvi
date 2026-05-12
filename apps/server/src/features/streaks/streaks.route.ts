import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StreaksService } from "./streaks.service";
import { StreaksRepository } from "./streaks.repository";
import { ShieldsRepository } from "../shields/shields.repository";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

export const streaksRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new StreaksRepository(db);
  const shieldsRepo = new ShieldsRepository(db);
  const service = new StreaksService(repo, shieldsRepo);
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

      await fastify.cache.setUntilMidnight(cacheKey, response.data);

      return response;
    }
  );
};
