import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { RbacException } from '../errors/rbac.exception';
import { RBAC_ERROR_CODES } from '../errors/rbac.exception';
import { HttpStatus } from '@nestjs/common';
import { RBAC_PERMISSION_FETCHER } from '../constants';

export type PermissionFetcher = (userId: string) => Promise<string[]>;

declare global {
  namespace Express {
    interface Request {
      permissions?: string[];
    }
  }
}

/**
 * Fetches the current user's aggregated permissions and attaches them to the request.
 * Must run after JwtAuthGuard so req.user exists.
 */
@Injectable()
export class PermissionsAttachmentGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsAttachmentGuard.name);

  constructor(
    @Inject(RBAC_PERMISSION_FETCHER) private readonly permissionFetcher: PermissionFetcher,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: { userId: string } }>();
    const user = request.user;
    if (!user?.userId) {
      throw new RbacException(
        HttpStatus.UNAUTHORIZED,
        RBAC_ERROR_CODES.UNAUTHENTICATED,
        'Authentication required',
      );
    }
    try {
      const permissions = await this.permissionFetcher(user.userId);
      request.permissions = permissions;
      return true;
    } catch (err) {
      this.logger.error('Failed to fetch permissions', err);
      throw new RbacException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        RBAC_ERROR_CODES.INTERNAL_ERROR,
        'Failed to load permissions',
      );
    }
  }
}
