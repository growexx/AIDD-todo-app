import { Logger } from '@nestjs/common';

let client: { get: (k: string) => Promise<string | null>; set: (k: string, v: string, px?: number) => Promise<unknown>; del: (k: string) => Promise<unknown> } | undefined;

const logger = new Logger('Redis');

/**
 * Returns a connected Redis client if REDIS_URL is set, otherwise undefined.
 * No import errors or startup crash when Redis is not configured.
 */
export async function createRedisClient(): Promise<typeof client> {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.log('Redis not configured — caching disabled');
    return undefined;
  }
  try {
    const { Redis } = await import('ioredis');
    const redis = new Redis(url);
    redis.on('error', (err: Error) => logger.warn('Redis error:', err));
    client = {
      get: (k: string) => redis.get(k),
      set: (k: string, v: string, px?: number) => (px ? redis.set(k, v, 'EX', px) : redis.set(k, v)),
      del: (k: string) => redis.del(k),
    };
    logger.log('Redis caching enabled');
    return client;
  } catch (err) {
    logger.warn('Redis connection failed — caching disabled', err);
    return undefined;
  }
}

export function getRedisClient(): typeof client {
  return client;
}
