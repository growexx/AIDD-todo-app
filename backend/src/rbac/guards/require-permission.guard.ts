import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RbacException } from '../errors/rbac.exception';
import { RBAC_ERROR_CODES } from '../errors/rbac.exception';
import { HttpStatus } from '@nestjs/common';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { matchesPermission } from '../utils/wildcard.matcher';

/**
 * Uses req.permissions (set by PermissionsAttachmentGuard) to authorize the request.
 * Must run after PermissionsAttachmentGuard.
 */
@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: { userId: string }; permissions?: string[] }>();
    const user = request.user;
    if (!user?.userId) {
      throw new RbacException(
        HttpStatus.UNAUTHORIZED,
        RBAC_ERROR_CODES.UNAUTHENTICATED,
        'Authentication required',
      );
    }
    const permissions = request.permissions;
    if (!Array.isArray(permissions)) {
      throw new RbacException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        RBAC_ERROR_CODES.INTERNAL_ERROR,
        'Permissions not attached; ensure PermissionsAttachmentGuard runs first',
      );
    }
    const required = this.reflector.get<string>(REQUIRE_PERMISSION_KEY, context.getHandler());
    if (!required) {
      return true;
    }
    if (!matchesPermission(permissions, required)) {
      throw new RbacException(
        HttpStatus.FORBIDDEN,
        RBAC_ERROR_CODES.PERMISSION_DENIED,
        'Permission denied',
        { requiredPermission: required },
      );
    }
    return true;
  }
}
