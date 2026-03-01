import type { FastifyInstance } from "fastify";
import { db } from "@pruvi/db";
import { getSubjectsWithCount } from "./subjects.repository";

export function registerSubjectsRoutes(fastify: FastifyInstance) {
  fastify.get("/subjects", async (_request, reply) => {
    const subjects = await getSubjectsWithCount(db);
    reply.send(subjects);
  });
}
