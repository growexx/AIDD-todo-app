import { RbacService } from './rbac.service';

const CACHE_KEY_PREFIX = 'rbac:permissions:';

export type CachedPermissionFetcher = (userId: string) => Promise<string[]>;

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, px?: number): Promise<unknown>;
}

/**
 * Returns a permission fetcher. If redisClient is provided, caches results with TTL.
 * On Redis error: log warning and fall back to DB. Never crash the request.
 */
export function createCachedPermissionFetcher(
  rbacService: RbacService,
  redisClient: RedisLike | undefined,
  ttlSeconds: number,
): CachedPermissionFetcher {
  if (!redisClient) {
    return (userId: string) => rbacService.getUserPermissions(userId);
  }
  return async (userId: string): Promise<string[]> => {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as string[];
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.warn('[RBAC] Cache get error, falling back to DB:', err);
    }
    try {
      const permissions = await rbacService.getUserPermissions(userId);
      await redisClient.set(key, JSON.stringify(permissions), ttlSeconds).catch((err) => {
        console.warn('[RBAC] Cache set error:', err);
      });
      return permissions;
    } catch (err) {
      console.warn('[RBAC] getUserPermissions error:', err);
      throw err;
    }
  };
}
