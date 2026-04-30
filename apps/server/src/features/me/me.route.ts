import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { type MeResponse } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { MeRepository } from "./me.repository";
import { MeService } from "./me.service";
import { StreaksRepository } from "../streaks/streaks.repository";
import { StreaksService } from "../streaks/streaks.service";
import { LivesRepository } from "../lives/lives.repository";
import { LivesService } from "../lives/lives.service";

const repo = new MeRepository(db);
const service = new MeService(
  repo,
  new StreaksService(new StreaksRepository(db)),
  new LivesService(new LivesRepository(db)),
);

const CACHE_TTL = 60;

export const meRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const cacheKey = `me:${request.userId}`;

      const cached = await fastify.cache.get<MeResponse>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.buildBundle(request.userId);
      const response = unwrapResult(result);

      await fastify.cache.set(cacheKey, response.data, CACHE_TTL);
      return response;
    },
  );
};
