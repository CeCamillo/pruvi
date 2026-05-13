import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { UpdateSessionPreferencesBodySchema, SessionPreferencesSchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse } from "../../types";
import { NotFoundError } from "../../utils/errors";
import { SessionPreferencesRepository } from "./session-preferences.repository";

const repo = new SessionPreferencesRepository(db);
const TTL = 60;

export const sessionPreferencesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/session-preferences",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: SessionPreferencesSchema }) } },
    },
    async (request) => {
      const cacheKey = `prefs:session:${request.userId}`;
      const cached = await fastify.cache.get<{ showTimer: boolean }>(cacheKey);
      if (cached) return successResponse(cached);
      const row = await repo.get(request.userId);
      if (!row) {
        throw new NotFoundError("User not found");
      }
      await fastify.cache.set(cacheKey, row, TTL);
      return successResponse(row);
    },
  );

  fastify.put(
    "/users/me/session-preferences",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: UpdateSessionPreferencesBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: SessionPreferencesSchema }) },
      },
    },
    async (request) => {
      const updated = await repo.update(request.userId, request.body);
      if (!updated) throw new NotFoundError("User not found");
      await fastify.cache.del(`prefs:session:${request.userId}`);
      return successResponse(updated);
    },
  );
};
