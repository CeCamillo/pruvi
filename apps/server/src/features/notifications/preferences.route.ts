import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UpdateNotificationPreferencesBodySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { PreferencesRepository } from "./preferences.repository";
import { PreferencesService } from "./preferences.service";

const repo = new PreferencesRepository(db);
const service = new PreferencesService(repo);

const PREFS_TTL = 60;

export const preferencesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/notification-preferences",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const cacheKey = `prefs:notif:${request.userId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) return successResponse(cached);

      const result = await service.get(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PREFS_TTL);
      return response;
    },
  );

  fastify.put(
    "/users/me/notification-preferences",
    {
      preHandler: [fastify.authenticate],
      schema: { body: UpdateNotificationPreferencesBodySchema },
    },
    async (request) => {
      const result = await service.update(request.userId, request.body);
      const response = unwrapResult(result);
      await fastify.cache.del(`prefs:notif:${request.userId}`);
      return response;
    },
  );
};
