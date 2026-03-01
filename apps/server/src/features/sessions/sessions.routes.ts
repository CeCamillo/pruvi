import type { FastifyInstance } from "fastify";

import { db } from "@pruvi/db";
import { completeSessionRequestSchema } from "@pruvi/shared/sessions";

import { sessionPrepQueue } from "../../queues/session-prep.queue";
import { completeSession, getTodayInfo, startSession } from "./sessions.service";

export function registerSessionsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { count?: number } }>("/sessions/start", async (request, reply) => {
    const count = typeof request.body.count === "number" ? request.body.count : 5;

    const result = await startSession(db, { userId: request.userId, count });
    if (result.isErr()) throw result.error;

    return reply.status(200).send(result.value);
  });

  fastify.post<{
    Params: { id: string };
    Body: { questionsAnswered: number; questionsCorrect: number };
  }>("/sessions/:id/complete", async (request, reply) => {
    const sessionId = Number(request.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return reply.status(400).send({ error: "Invalid session id", code: "VALIDATION_ERROR" });
    }

    const parsed = completeSessionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", code: "VALIDATION_ERROR" });
    }

    const result = await completeSession(db, sessionPrepQueue, {
      sessionId,
      userId: request.userId,
      questionsAnswered: parsed.data.questionsAnswered,
      questionsCorrect: parsed.data.questionsCorrect,
    });

    if (result.isErr()) throw result.error;

    return reply.status(200).send(result.value);
  });

  fastify.get("/sessions/today", async (request, reply) => {
    // getTodayInfo returns Result<T, never> — cannot error
    const session = (await getTodayInfo(db, request.userId))._unsafeUnwrap();

    if (!session) {
      return reply.status(404).send({ error: "No session today", code: "NOT_FOUND" });
    }

    return reply.status(200).send(session);
  });
}
