import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { RankingResponseSchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../../types";
import { ok } from "neverthrow";
import { RankingRepository } from "./ranking.repository";
import { RankingService } from "./ranking.service";

const repo = new RankingRepository(db);
const service = new RankingService(repo);

export const rankingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/friends/ranking",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: z.object({ success: z.literal(true), data: RankingResponseSchema }),
        },
      },
    },
    async (request) => {
      const result = ok(await service.getRanking(request.userId, new Date()));
      return unwrapResult(result);
    },
  );
};
