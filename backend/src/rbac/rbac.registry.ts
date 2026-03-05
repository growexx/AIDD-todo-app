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
  USER_CREATE: 'user:create',
  USER_VIEW: 'user:view',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  ADMIN_CREATE: 'admin:create',
  ADMIN_VIEW: 'admin:view',
  ADMIN_UPDATE: 'admin:update',
  ADMIN_DELETE: 'admin:delete',
  TASK_CREATE: 'task:create',
  TASK_VIEW: 'task:view',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_UPDATE_STATUS: 'task:update-status',
  OWN_PROFILE_VIEW: 'own:profile-view',
  OWN_PROFILE_UPDATE: 'own:profile-update',
  OWN_TASK_VIEW: 'own:task-view',
  OWN_TASK_CREATE: 'own:task-create',
  OWN_TASK_UPDATE: 'own:task-update',
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
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.ADMIN_CREATE,
    PERMISSIONS.ADMIN_VIEW,
    PERMISSIONS.ADMIN_UPDATE,
    PERMISSIONS.ADMIN_DELETE,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_DELETE,
    PERMISSIONS.TASK_UPDATE_STATUS,
    PERMISSIONS.OWN_PROFILE_VIEW,
    PERMISSIONS.OWN_PROFILE_UPDATE,
    PERMISSIONS.OWN_TASK_VIEW,
    PERMISSIONS.OWN_TASK_CREATE,
    PERMISSIONS.OWN_TASK_UPDATE,
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
