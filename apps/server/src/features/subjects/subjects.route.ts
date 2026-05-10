import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "@pruvi/db";
import { SubjectsRepository } from "./subjects.repository";
import { SubjectsService } from "./subjects.service";
import { successResponse, unwrapResult } from "../../types";

const repo = new SubjectsRepository(db);
const service = new SubjectsService(repo);

const SUBJECTS_CACHE_TTL = 300;
const CACHE_KEY = "subjects:list";

export const subjectsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/subjects",
    { preHandler: [fastify.authenticate] },
    async () => {
      const cached = await fastify.cache.get<unknown>(CACHE_KEY);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.list();
      const response = unwrapResult(result);
      await fastify.cache.set(CACHE_KEY, response.data, SUBJECTS_CACHE_TTL);
      return response;
    }
  );
};
