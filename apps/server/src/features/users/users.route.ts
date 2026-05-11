import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UpdateBasicProfileBodySchema, UpdateProfileBodySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";
import { unwrapResult } from "../../types";

const repo = new UsersRepository(db);
const service = new UsersService(repo);

export const usersRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.put(
    "/users/me/profile",
    {
      preHandler: [fastify.authenticate],
      schema: { body: UpdateBasicProfileBodySchema },
    },
    async (request) => {
      const result = await service.updateProfile(request.userId, request.body);
      return unwrapResult(result);
    }
  );

  // PATCH /users/me/profile — set username
  fastify.patch(
    "/users/me/profile",
    {
      preHandler: [fastify.authenticate],
      schema: { body: UpdateProfileBodySchema },
    },
    async (request) => {
      const result = await service.updateUsername(
        request.userId,
        request.body.username,
      );
      return unwrapResult(result);
    }
  );

  fastify.delete(
    "/users/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = await service.deleteAccount(request.userId);
      unwrapResult(result);
      reply.code(204).send();
    }
  );
};
