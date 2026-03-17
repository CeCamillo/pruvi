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

  /** Store a set of values with TTL (for session-bound question validation). */
  async sadd(key: string, members: (string | number)[], ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    if (members.length === 0) return;
    await this.redis.sadd(key, ...members.map(String));
    await this.redis.expire(key, ttlSeconds);
  }

  /** Check if a value is in a set. Returns true if Redis unavailable (graceful degradation). */
  async sismember(key: string, member: string | number): Promise<boolean> {
    if (!this.redis) return true; // allow if Redis is down
    return (await this.redis.sismember(key, String(member))) === 1;
  }

  /** Cache until midnight (local server time). Min TTL: 60s. */
  async setUntilMidnight(key: string, value: unknown): Promise<void> {
    if (!this.redis) return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ttl = Math.max(
      60,
      Math.floor((midnight.getTime() - now.getTime()) / 1000)
    );
    await this.redis.set(key, JSON.stringify(value), "EX", ttl);
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
