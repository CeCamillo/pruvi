import { env } from "@pruvi/env/server";
import Redis from "ioredis";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
