import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";
import { env } from "@pruvi/env/server";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis | null;
    cache: CacheHelper;
  }
}

export class CacheHelper {
  constructor(private redis: Redis | null) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(key);
  }
}

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  let redis: Redis | null = null;

  if (env.REDIS_URL) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      fastify.log.info("Redis connected");
    } catch (err) {
      fastify.log.warn({ err }, "Redis connection failed — running without cache");
      redis = null;
    }
  } else {
    fastify.log.info("No REDIS_URL configured — running without cache");
  }

  fastify.decorate("redis", redis);
  fastify.decorate("cache", new CacheHelper(redis));

  fastify.addHook("onClose", async () => {
    if (redis) {
      await redis.quit();
    }
  });
};

export const redisPlugin = fp(plugin, {
  name: "redis",
});
