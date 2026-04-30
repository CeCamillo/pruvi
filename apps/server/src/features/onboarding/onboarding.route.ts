import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  onboardingCompleteBodySchema,
  userPreferencesSchema,
} from "@pruvi/shared";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../types";
import { OnboardingRepository } from "./onboarding.repository";
import { OnboardingService } from "./onboarding.service";

const repo = new OnboardingRepository(db);
const service = new OnboardingService(repo);

export const onboardingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /users/me/preferences — read-only snapshot used by the native
  // auth guard to decide whether to enter the onboarding stack.
  fastify.get(
    "/users/me/preferences",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await service.getPreferences(request.userId);
      return unwrapResult(result);
    }
  );

  // PUT /users/me/preferences — partial update. Does NOT mark onboarding
  // complete. Clients can persist progress incrementally; POST
  // /onboarding/complete is what actually flips the flag.
  fastify.put(
    "/users/me/preferences",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: userPreferencesSchema,
      },
    },
    async (request) => {
      const result = await service.updatePreferences(
        request.userId,
        request.body
      );
      // Swallow cache failures — stale data self-heals via TTL.
      await fastify.cache.del(`me:${request.userId}`).catch((err: unknown) => {
        fastify.log.warn(
          { err, userId: request.userId },
          "preferences cache invalidation failed",
        );
      });
      return unwrapResult(result);
    }
  );

  // POST /onboarding/complete — saves all 4 answers and flips
  // onboarding_completed=true in one atomic update.
  fastify.post(
    "/onboarding/complete",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: onboardingCompleteBodySchema,
      },
    },
    async (request) => {
      const result = await service.completeOnboarding(
        request.userId,
        request.body
      );
      // Swallow cache failures — stale data self-heals via TTL.
      await fastify.cache.del(`me:${request.userId}`).catch((err: unknown) => {
        fastify.log.warn(
          { err, userId: request.userId },
          "onboarding-complete cache invalidation failed",
        );
      });
      return unwrapResult(result);
    }
  );
};
