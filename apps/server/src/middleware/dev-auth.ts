import { db } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export function registerDevAuth(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (request) => {
    const userId = (request.headers["x-user-id"] as string | undefined) ?? "local-tester";

    await db
      .insert(user)
      .values({
        id: userId,
        name: userId,
        email: `${userId}@dev.local`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    request.userId = userId;
  });
}
