import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  roletaAnswerBodySchema,
  roletaConfigSchema,
} from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { RoletaRepository } from "./roleta.repository";
import { RoletaService } from "./roleta.service";

const repo = new RoletaRepository(db);
const service = new RoletaService(repo);

const CONFIG_TTL = 5 * 60; // 5 minutes

export const roletaRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /roleta/config — cached, with resolved defaults.
  fastify.get(
    "/roleta/config",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `roleta-config:${request.userId}`;
      const cached = await fastify.cache.get<{ subjects: string[] }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.getConfig(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, CONFIG_TTL);
      return response;
    }
  );

  // PUT /roleta/config — partial/full replacement.
  fastify.put(
    "/roleta/config",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: roletaConfigSchema,
      },
    },
    async (request) => {
      // Invalidate BEFORE unwrap — if the service throws via unwrap, we
      // don't want a stale cache. Same pattern as reviews.route.ts.
      await fastify.cache.del(`roleta-config:${request.userId}`);
      const result = await service.saveConfig(request.userId, request.body);
      return unwrapResult(result);
    }
  );

  // POST /roleta/spin — one subject random from pool, 3 questions random from it.
  fastify.post(
    "/roleta/spin",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await service.spin(request.userId);
      return unwrapResult(result);
    }
  );

  // POST /roleta/answer — grade + half XP + review_log row.
  fastify.post(
    "/roleta/answer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: roletaAnswerBodySchema,
      },
    },
    async (request) => {
      // XP / progress caches go stale after every answer.
      await Promise.allSettled([
        fastify.cache.del(`me:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
        fastify.cache.del(`progress:${request.userId}`),
      ]);
      const result = await service.answer(request.userId, request.body);
      return unwrapResult(result);
    }
  );
};
