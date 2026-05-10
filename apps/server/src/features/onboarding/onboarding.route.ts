import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  UpdatePreferencesBodySchema,
  CompleteOnboardingBodySchema,
} from "@pruvi/shared";
import { db } from "@pruvi/db";
import { OnboardingRepository } from "./onboarding.repository";
import { OnboardingService } from "./onboarding.service";
import { successResponse, unwrapResult } from "../../types";

const repo = new OnboardingRepository(db);
const service = new OnboardingService(repo);

const PREFS_CACHE_TTL = 60;

export const onboardingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/preferences",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const cacheKey = `prefs:${request.userId}`;
      const cached = await fastify.cache.get<unknown>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }
      const result = await service.getPreferences(request.userId);
      const response = unwrapResult(result);
      await fastify.cache.set(cacheKey, response.data, PREFS_CACHE_TTL);
      return response;
    }
  );

  fastify.put(
    "/users/me/preferences",
    {
      preHandler: [fastify.authenticate],
      schema: { body: UpdatePreferencesBodySchema },
    },
    async (request) => {
      const result = await service.updatePreferences(
        request.userId,
        request.body
      );
      const response = unwrapResult(result);
      await fastify.cache.del(`prefs:${request.userId}`);
      return response;
    }
  );

  fastify.post(
    "/onboarding/complete",
    {
      preHandler: [fastify.authenticate],
      schema: { body: CompleteOnboardingBodySchema },
    },
    async (request) => {
      const result = await service.completeOnboarding(
        request.userId,
        request.body
      );
      const response = unwrapResult(result);
      await fastify.cache.del(`prefs:${request.userId}`);
      return response;
    }
  );
};
