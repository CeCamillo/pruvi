import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ShieldBalanceResponseSchema, type ShieldBalanceResponse } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { ShieldsRepository } from "./shields.repository";
import { ShieldsService } from "./shields.service";

const SHIELDS_CACHE_TTL = 60;

export const shieldsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new ShieldsRepository(db);
  const service = new ShieldsService(repo);

  fastify.get(
    "/users/me/shields",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: ShieldBalanceResponseSchema }) } },
    },
    async (request) => {
      const cacheKey = `shields:${request.userId}`;
      const cached = await fastify.cache.get<ShieldBalanceResponse>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }
      const response = unwrapResult(await service.getBalance(request.userId));
      await fastify.cache.set(cacheKey, response.data, SHIELDS_CACHE_TTL);
      return response;
    },
  );
};
