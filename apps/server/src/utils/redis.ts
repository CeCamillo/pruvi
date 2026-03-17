/** Parse a Redis URL into BullMQ-compatible connection options. */
export function parseRedisUrl(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
