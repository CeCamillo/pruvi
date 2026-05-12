import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { GrantUltraBodySchema, UltraStatusSchema } from "@pruvi/shared";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { unwrapResult, successResponse } from "../../types";
import { AppError, UnauthorizedError } from "../../utils/errors";
import { UltraRepository } from "./ultra.repository";
import { UltraService } from "./ultra.service";

const repo = new UltraRepository(db);
const service = new UltraService(repo);

const adminGuard = async (request: FastifyRequest) => {
  if (!env.ADMIN_API_TOKEN) {
    throw new AppError("Admin API disabled", 503, "ADMIN_DISABLED");
  }
  const token = request.headers["x-admin-token"];
  if (token !== env.ADMIN_API_TOKEN) {
    throw new UnauthorizedError("Admin token required");
  }
};

export const ultraRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/ultra
  fastify.get(
    "/users/me/ultra",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: UltraStatusSchema }) } },
    },
    async (request) => {
      return successResponse(unwrapResult(await service.getStatus(request.userId)).data);
    },
  );

  // POST /admin/users/:userId/ultra — grant Ultra
  fastify.post(
    "/admin/users/:userId/ultra",
    {
      preHandler: [adminGuard],
      schema: { params: z.object({ userId: z.string() }), body: GrantUltraBodySchema },
    },
    async (request) => {
      const { userId } = request.params as { userId: string };
      const { expiresAt } = request.body as { expiresAt: string };
      return successResponse(unwrapResult(await service.grant(userId, new Date(expiresAt))));
    },
  );

  // DELETE /admin/users/:userId/ultra — revoke Ultra
  fastify.delete(
    "/admin/users/:userId/ultra",
    {
      preHandler: [adminGuard],
      schema: { params: z.object({ userId: z.string() }) },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      unwrapResult(await service.revoke(userId));
      return reply.code(204).send();
    },
  );
};
