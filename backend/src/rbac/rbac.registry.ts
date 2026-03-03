/**
 * Permission registry: single source of truth for all permission codes.
 * All codes must be defined here and seeded from here.
 * Never hardcode permission strings elsewhere.
 */

const PERMISSION_REGEX =
  /^(\*:\*|[a-z][a-z0-9_-]*:\*|[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*)$/;

/** Permission codes (generic, domain-agnostic). */
export const PERMISSIONS = {
  ROLE_CREATE: 'role:create',
  ROLE_VIEW: 'role:view',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  PERMISSION_VIEW: 'permission:view',
  PERMISSION_MANAGE: 'permission:manage',
  ROLE_ASSIGN: 'role:assign',
  ROLE_REVOKE: 'role:revoke',
  USER_VIEW_PERMISSIONS: 'user:view-permissions',
  GLOBAL_WILDCARD: '*:*',
} as const;

/** All standard (non-wildcard) codes as array. */
export function getAllPermissionCodes(): string[] {
  return [
    PERMISSIONS.ROLE_CREATE,
    PERMISSIONS.ROLE_VIEW,
    PERMISSIONS.ROLE_UPDATE,
    PERMISSIONS.ROLE_DELETE,
    PERMISSIONS.PERMISSION_VIEW,
    PERMISSIONS.PERMISSION_MANAGE,
    PERMISSIONS.ROLE_ASSIGN,
    PERMISSIONS.ROLE_REVOKE,
    PERMISSIONS.USER_VIEW_PERMISSIONS,
  ];
}

/** All codes including wildcards (for seeding). */
export function getAllPermissionCodesWithWildcards(): string[] {
  return [...getAllPermissionCodes(), PERMISSIONS.GLOBAL_WILDCARD];
}

/**
 * Validates a permission code against the registry regex.
 */
export function isValidPermissionCode(code: string): boolean {
  return typeof code === 'string' && PERMISSION_REGEX.test(code.trim());
}
