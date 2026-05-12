import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AcceptInvitationBodySchema, InviteLinkResponseSchema } from "@pruvi/shared";
import { z } from "zod";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../../types";
import { InvitationsRepository } from "./invitations.repository";
import { InvitationsService } from "./invitations.service";

const AcceptInvitationResponseSchema = z.object({
  inviter: z.object({ name: z.string(), username: z.string().nullable() }),
  reward: z.object({
    type: z.enum(["xp", "shield"]),
    xpAwarded: z.number().int(),
    shieldGranted: z.boolean(),
  }),
  friendshipCreated: z.literal(true),
});

const repo = new InvitationsRepository(db);
const service = new InvitationsService(repo);

export const invitationsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/users/me/invite",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: z.object({ success: z.literal(true), data: InviteLinkResponseSchema }),
        },
      },
    },
    async (request) => {
      const result = await service.getInvite(request.userId);
      return unwrapResult(result);
    },
  );

  fastify.post(
    "/invitations/accept",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: AcceptInvitationBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: AcceptInvitationResponseSchema }) },
      },
    },
    async (request) => {
      const { code } = request.body;
      const result = await service.acceptInvitation(code, request.userId);
      return unwrapResult(result);
    },
  );
};
