import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { RegisterPushTokenBodySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";
import { TokensRepository } from "./tokens.repository";
import { TokensService } from "./tokens.service";

const repo = new TokensRepository(db);
const service = new TokensService(repo);

export const tokensRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/users/me/push-tokens",
    {
      preHandler: [fastify.authenticate],
      schema: { body: RegisterPushTokenBodySchema },
    },
    async (request) => {
      const { token, platform } = request.body;
      const result = await service.register(request.userId, token, platform);
      return unwrapResult(result);
    },
  );

  fastify.delete(
    "/users/me/push-tokens/:token",
    {
      preHandler: [fastify.authenticate],
      schema: { params: z.object({ token: z.string() }) },
    },
    async (request, reply) => {
      const { token } = request.params;
      await service.unregister(request.userId, token);
      reply.status(204).send();
    },
  );
};
