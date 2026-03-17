import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";

const repo = new UsersRepository(db);
const service = new UsersService(repo);

export const usersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/data — LGPD data export (right to data portability)
  fastify.get(
    "/users/me/data",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await service.exportData(request.userId);
      return unwrapResult(result);
    }
  );

  // DELETE /users/me — LGPD account deletion (right to erasure)
  fastify.delete(
    "/users/me",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await service.deleteAccount(request.userId);
      unwrapResult(result);

      // Clear all Redis cache keys for this user
      await Promise.all([
        fastify.cache.del(`lives:${request.userId}`),
        fastify.cache.del(`xp:${request.userId}`),
        fastify.cache.del(`streaks:${request.userId}`),
        fastify.cache.del(`session-today:${request.userId}`),
        fastify.cache.del(`prefetch:${request.userId}`),
      ]);

      return successResponse({ deleted: true });
    }
  );
};
