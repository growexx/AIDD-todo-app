/**
 * Wildcard matching: must match backend algorithm (section 6).
 * Never check role names — only permission codes.
 */
export function matchesPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*:*')) return true;
  if (userPermissions.includes(required)) return true;
  const [module] = required.split(':');
  if (module && userPermissions.includes(`${module}:*`)) return true;
  return false;
}
