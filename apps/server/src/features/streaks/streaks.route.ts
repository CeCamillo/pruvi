import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { StreaksService } from "./streaks.service";
import { StreaksRepository } from "./streaks.repository";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";

const repo = new StreaksRepository(db);
const service = new StreaksService(repo);

export const streaksRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /streaks
  fastify.get(
    "/streaks",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await service.getStreaks(request.userId);
      return unwrapResult(result);
    }
  );
};
