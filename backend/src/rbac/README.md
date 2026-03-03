# RBAC Module

Role-Based Access Control: roles, permissions, user–role assignments, and permission-based authorization. Independent from authentication; consumes `req.user.userId` only.

## Configuration

- **API_PREFIX**: Base path for RBAC routes (default: `api/rbac`).
- **DEFAULT_ADMIN_ROLE**: Name of the seeded super-admin role (default: `super-admin`).
- **REDIS_URL**: If set, permission lookups are cached (TTL: **REDIS_CACHE_TTL_SECONDS**, default 300).
- **DEMO_AUTH**: If `true`, sets `req.user` from header `x-demo-user-id` (development only; forbidden in production).

## Seeding

Run once (idempotent):

```bash
npm run seed:rbac
```

Requires `MONGODB_URI`. Seeds: all permission codes, `super-admin` role with `*:*`, and `rbac-admin` role with RBAC permissions.

**Assign roles to existing users:** set `SEED_SUPER_ADMIN_EMAILS` in `.env` to a comma-separated list of emails (e.g. `alice@todoapp.com,bob@todoapp.com`). When you run `npm run seed:rbac`, those users will be given the `super-admin` role so they can access RBAC and all other protected features. Re-running the seed is idempotent (already-assigned users are skipped).

## Adding project-specific permissions

1. Create a separate registry file (e.g. `modules/tasks/task.permissions.ts`) with your permission codes.
2. Ensure each code matches the regex: `module:action` or `module:*` or `*:*`.
3. In your seed or app bootstrap, call the seeder with the combined list (e.g. merge `getAllPermissionCodesWithWildcards()` with your codes and upsert into the Permission collection).

## Rate limiting

RBAC routes use the global ThrottlerGuard. Recommended: 100 req/15 min (read), 30 req/15 min (write). Configure via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`.
