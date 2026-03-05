/**
 * Wildcard matching: must be implemented identically on backend, React, and Flutter.
 * Never check role names — only aggregated permission codes.
 */
export function matchesPermission(userPermissions: string[], required: string): boolean {
  if (!Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*:*')) return true;
  if (userPermissions.includes(required)) return true;
  const [module] = required.split(':');
  if (module && userPermissions.includes(`${module}:*`)) return true;
  return false;
}
