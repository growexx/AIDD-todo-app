import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'rbac:required_permission';

export function RequirePermission(permission: string) {
  return SetMetadata(REQUIRE_PERMISSION_KEY, permission);
}
