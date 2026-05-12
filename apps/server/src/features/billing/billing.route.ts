import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest, FastifyReply } from "fastify";
import { GooglePlayLinkBodySchema, GooglePlayLinkResponseSchema, AppStoreLinkBodySchema, AppStoreLinkResponseSchema } from "@pruvi/shared";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { AppError, UnauthorizedError, NotFoundError } from "../../utils/errors";
import { BillingRepository } from "./billing.repository";
import { BillingService } from "./billing.service";
import { UltraRepository } from "../ultra/ultra.repository";
import { UltraService } from "../ultra/ultra.service";

const repo = new BillingRepository();
const ultra = new UltraService(new UltraRepository(db));
const service = new BillingService(db, repo, ultra);

// IMPORTANT: throw AppError subclasses so the project's error handler maps statusCode correctly.
// Plain `throw new Error(...)` would fall through to the 500 branch regardless of reply.code().
async function webhookGuard(request: FastifyRequest, _reply: FastifyReply) {
  if (!env.GOOGLE_PLAY_WEBHOOK_TOKEN) {
    throw new AppError("WEBHOOK_DISABLED", 503, "WEBHOOK_DISABLED");
  }
  const provided = request.headers["x-pruvi-webhook-token"];
  if (typeof provided !== "string") {
    throw new UnauthorizedError("UNAUTHORIZED");
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(env.GOOGLE_PLAY_WEBHOOK_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError("UNAUTHORIZED");
  }
}

// IMPORTANT: throw AppError subclasses (not plain Error) so the error handler maps statusCode correctly.
// Returns 404 on token mismatch to keep the endpoint URL-obscure (not 401/403).
async function appStorePathGuard(request: FastifyRequest) {
  if (!env.APP_STORE_WEBHOOK_TOKEN) {
    throw new AppError("WEBHOOK_DISABLED", 503, "WEBHOOK_DISABLED");
  }
  const { token } = request.params as { token: string };
  if (typeof token !== "string") {
    throw new NotFoundError("Not Found");
  }
  const a = Buffer.from(token);
  const b = Buffer.from(env.APP_STORE_WEBHOOK_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new NotFoundError("Not Found");
  }
}

export const billingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/webhooks/google-play",
    {
      schema: {
        body: z.unknown(),
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.object({ received: z.boolean(), messageId: z.string().optional(), kind: z.string().optional(), error: z.string().optional() }),
          }),
        },
      },
      preHandler: [webhookGuard],
    },
    async (request) => {
      const result = await service.processGooglePlayEnvelope(request.body);
      if (result.isErr()) {
        const error = result.error;
        // For MALFORMED_ENVELOPE we still return 200 so Pub/Sub stops retrying.
        if (error.code === "MALFORMED_ENVELOPE") {
          fastify.log.warn({ err: error.message }, "google-play webhook malformed envelope");
          return successResponse({ received: false, error: "MALFORMED_ENVELOPE" });
        }
        fastify.log.error({ err: error.message }, "google-play webhook processing failed");
        return successResponse({ received: false, error: "PROCESSING_FAILED" });
      }
      return successResponse({ received: true, messageId: result.value.messageId, kind: result.value.kind });
    },
  );

  fastify.post(
    "/billing/google-play/link",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: GooglePlayLinkBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: GooglePlayLinkResponseSchema }) },
      },
    },
    async (request) => {
      const data = unwrapResult(await service.linkGooglePlayPurchase(request.userId, request.body)).data;
      return successResponse(data);
    },
  );

  fastify.post(
    "/webhooks/app-store/:token",
    {
      schema: {
        params: z.object({ token: z.string() }),
        body: z.unknown(),
        response: {
          200: z.object({
            success: z.literal(true),
            data: z.object({
              received: z.boolean(),
              notificationUUID: z.string().optional(),
              kind: z.string().optional(),
              error: z.string().optional(),
            }),
          }),
        },
      },
      preHandler: [appStorePathGuard],
    },
    async (request) => {
      const result = await service.processAppStoreEnvelope(request.body);
      if (result.isErr()) {
        const error = result.error;
        if (error.code === "MALFORMED_ENVELOPE") {
          fastify.log.warn({ err: error.message }, "app-store webhook malformed envelope");
          return successResponse({ received: false, error: "MALFORMED_ENVELOPE" });
        }
        fastify.log.error({ err: error.message }, "app-store webhook processing failed");
        return successResponse({ received: false, error: "PROCESSING_FAILED" });
      }
      return successResponse({ received: true, notificationUUID: result.value.notificationUUID, kind: result.value.kind });
    },
  );

  fastify.post(
    "/billing/app-store/link",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: AppStoreLinkBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: AppStoreLinkResponseSchema }) },
      },
    },
    async (request) => {
      const data = unwrapResult(await service.linkAppStorePurchase(request.userId, request.body)).data;
      return successResponse(data);
    },
  );
};
