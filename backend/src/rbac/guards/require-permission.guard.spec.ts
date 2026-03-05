import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequirePermissionGuard } from './require-permission.guard';
import { RbacException } from '../errors/rbac.exception';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

describe('RequirePermissionGuard', () => {
  let guard: RequirePermissionGuard;
  let reflector: Reflector;

  const createMockContext = (request: {
    user?: { userId: string };
    permissions?: string[];
  }): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RequirePermissionGuard(reflector);
  });

  it('throws 401 when user is missing', () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(RbacException);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect((e as RbacException).getStatus()).toBe(401);
    }
  });

  it('throws 401 when user.userId is missing', () => {
    const ctx = createMockContext({ user: {} as { userId: string } });
    expect(() => guard.canActivate(ctx)).toThrow(RbacException);
  });

  it('throws 500 when permissions not attached', () => {
    const ctx = createMockContext({
      user: { userId: 'u1' },
      permissions: undefined,
    });
    jest.spyOn(reflector, 'get').mockReturnValue('role:view');
    expect(() => guard.canActivate(ctx)).toThrow(RbacException);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect((e as RbacException).getStatus()).toBe(500);
    }
  });

  it('returns true when no required permission (no decorator)', () => {
    const ctx = createMockContext({
      user: { userId: 'u1' },
      permissions: [],
    });
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when user has exact permission', () => {
    const ctx = createMockContext({
      user: { userId: 'u1' },
      permissions: ['role:create'],
    });
    jest.spyOn(reflector, 'get').mockReturnValue('role:create');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when user has *:*', () => {
    const ctx = createMockContext({
      user: { userId: 'u1' },
      permissions: ['*:*'],
    });
    jest.spyOn(reflector, 'get').mockReturnValue('role:create');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when user has module wildcard', () => {
    const ctx = createMockContext({
      user: { userId: 'u1' },
      permissions: ['role:*'],
    });
    jest.spyOn(reflector, 'get').mockReturnValue('role:create');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws 403 when user lacks required permission', () => {
    const ctx = createMockContext({
      user: { userId: 'u1' },
      permissions: ['task:view'],
    });
    jest.spyOn(reflector, 'get').mockReturnValue('role:create');
    expect(() => guard.canActivate(ctx)).toThrow(RbacException);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect((e as RbacException).getStatus()).toBe(403);
      expect((e as RbacException).getDetails()?.requiredPermission).toBe('role:create');
    }
  });
});
