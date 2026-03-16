import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { LivesService } from "./lives.service";
import { LivesRepository } from "./lives.repository";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";

const repo = new LivesRepository(db);
const service = new LivesService(repo);

export const livesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/lives
  fastify.get(
    "/users/me/lives",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await service.getLives(request.userId);
      return unwrapResult(result);
    }
  );
};
