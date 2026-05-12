import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  SimuladoAnswerBodySchema,
  SimuladoAnswerResponseSchema,
  SimuladoCurrentResponseSchema,
  SimuladoDetailResponseSchema,
  SimuladoResultsResponseSchema,
  SimuladoStartResponseSchema,
  type SimuladoCurrentResponse,
} from "@pruvi/shared";
import { db } from "@pruvi/db";
import { successResponse, unwrapResult } from "../../types";
import { SimuladosRepository } from "./simulados.repository";
import { SimuladosService } from "./simulados.service";
import { UltraRepository } from "../ultra/ultra.repository";
import { UltraService } from "../ultra/ultra.service";

const CURRENT_CACHE_TTL = 60;

export const simuladosRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const repo = new SimuladosRepository(db);
  const ultra = new UltraService(new UltraRepository(db));
  const service = new SimuladosService(repo, ultra);

  fastify.get(
    "/simulados/current",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: SimuladoCurrentResponseSchema }) } },
    },
    async (request) => {
      const cacheKey = `simulado:current:${request.userId}`;
      const cached = await fastify.cache.get<SimuladoCurrentResponse>(cacheKey);
      if (cached) return successResponse(cached);
      const data = unwrapResult(await service.getCurrent(request.userId)).data;
      await fastify.cache.set(cacheKey, data, CURRENT_CACHE_TTL);
      return successResponse(data);
    },
  );

  fastify.post(
    "/simulados/start",
    {
      preHandler: [fastify.authenticate],
      schema: { response: { 200: z.object({ success: z.literal(true), data: SimuladoStartResponseSchema }) } },
    },
    async (request) => {
      const data = unwrapResult(await service.start(request.userId)).data;
      await fastify.cache.del(`simulado:current:${request.userId}`);
      return successResponse(data);
    },
  );

  fastify.get(
    "/simulados/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        response: { 200: z.object({ success: z.literal(true), data: SimuladoDetailResponseSchema }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const data = unwrapResult(await service.getDetail(id, request.userId)).data;
      return successResponse(data);
    },
  );

  fastify.post(
    "/simulados/:id/answer",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        body: SimuladoAnswerBodySchema,
        response: { 200: z.object({ success: z.literal(true), data: SimuladoAnswerResponseSchema }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { questionId, selectedOptionIndex } = request.body;
      const data = unwrapResult(await service.recordAnswer(id, request.userId, questionId, selectedOptionIndex)).data;
      await fastify.cache.del(`simulado:current:${request.userId}`);
      return successResponse(data);
    },
  );

  fastify.post(
    "/simulados/:id/complete",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        response: { 200: z.object({ success: z.literal(true), data: z.object({ id: z.number().int(), completedAt: z.string() }) }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const data = unwrapResult(await service.forceComplete(id, request.userId)).data;
      await fastify.cache.del(`simulado:current:${request.userId}`);
      return successResponse(data);
    },
  );

  fastify.get(
    "/simulados/:id/results",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.coerce.number().int() }),
        response: { 200: z.object({ success: z.literal(true), data: SimuladoResultsResponseSchema }) },
      },
    },
    async (request) => {
      const { id } = request.params;
      const data = unwrapResult(await service.getResults(id, request.userId)).data;
      return successResponse(data);
    },
  );
};
