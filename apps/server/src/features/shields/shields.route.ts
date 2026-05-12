import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ShieldBalanceResponseSchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";
import { ShieldsRepository } from "./shields.repository";
import { ShieldsService } from "./shields.service";

export const shieldsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new ShieldsRepository(db);
  const service = new ShieldsService(repo);

  fastify.get(
    "/users/me/shields",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: ShieldBalanceResponseSchema }) } },
    },
    async (request) => unwrapResult(await service.getBalance(request.userId)),
  );
};
