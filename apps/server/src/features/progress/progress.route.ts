import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { calendarQuerySchema } from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { ProgressRepository } from "./progress.repository";
import { ProgressService } from "./progress.service";

const repo = new ProgressRepository(db);
const service = new ProgressService(repo);

const PROGRESS_TTL = 60; // seconds — matches xp TTL

export const progressRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/progress
  fastify.get(
    "/users/me/progress",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `progress:${request.userId}`;

      const cached = await fastify.cache.get<{
        subjects: Array<{
          slug: string;
          name: string;
          totalQuestions: number;
          correctCount: number;
          accuracy: number;
        }>;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getProgress(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PROGRESS_TTL);
      return response;
    },
  );

  // GET /subjects/:slug/reviews
  fastify.get(
    "/subjects/:slug/reviews",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          slug: z.string().min(1),
        }),
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const cacheKey = `subject-reviews:${request.userId}:${slug}`;

      const cached = await fastify.cache.get<{
        reviews: Array<{
          questionId: number;
          body: string;
          correct: boolean;
          reviewedAt: string;
        }>;
      }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getSubjectReviews(request.userId, slug);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PROGRESS_TTL);
      return response;
    },
  );

  // GET /users/me/calendar?month=YYYY-MM
  fastify.get(
    "/users/me/calendar",
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: calendarQuerySchema,
      },
    },
    async (request) => {
      const { month } = request.query as { month?: string };
      const cacheKey = `calendar:${request.userId}:${month ?? "current"}`;

      const cached = await fastify.cache.get<{ dates: string[] }>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const result = await service.getCalendar(request.userId, month);
      const response = unwrapResult(result);
      await fastify.cache.setUntilMidnight(cacheKey, response.data);
      return response;
    },
  );
};
