import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  RequestFriendBodySchema,
  RespondRequestBodySchema,
  FriendListResponseSchema,
  RequestListResponseSchema,
} from "@pruvi/shared";
import { db } from "@pruvi/db";
import { unwrapResult } from "../../../types";
import { FriendshipsRepository } from "./friendships.repository";
import { FriendshipsService } from "./friendships.service";

const repo = new FriendshipsRepository(db);
const service = new FriendshipsService(repo);

export const friendshipsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/users/me/friends/request",
    {
      preHandler: [fastify.authenticate],
      schema: { body: RequestFriendBodySchema },
    },
    async (request) => {
      const { username } = request.body;
      const result = await service.requestByUsername(request.userId, username);
      return unwrapResult(result);
    },
  );

  fastify.get(
    "/users/me/friends/requests",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: z.object({ success: z.literal(true), data: RequestListResponseSchema }),
        },
      },
    },
    async (request) => {
      const result = await service.listRequests(request.userId);
      return unwrapResult(result);
    },
  );

  fastify.patch(
    "/users/me/friends/requests/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: RespondRequestBodySchema,
      },
    },
    async (request) => {
      const { id } = request.params;
      const { action } = request.body;
      const result = await service.respond(id, action, request.userId);
      return unwrapResult(result);
    },
  );

  fastify.get(
    "/users/me/friends",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: z.object({ success: z.literal(true), data: FriendListResponseSchema }),
        },
      },
    },
    async (request) => {
      const result = await service.listFriends(request.userId);
      return unwrapResult(result);
    },
  );

  fastify.delete(
    "/users/me/friends/:friendUserId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ friendUserId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const { friendUserId } = request.params;
      const result = await service.unfriend(request.userId, friendUserId);
      unwrapResult(result);
      reply.status(204).send();
    },
  );
};
