import { ExecutionContext } from '@nestjs/common';
import { PermissionsAttachmentGuard } from './permissions-attachment.guard';
import { RbacException } from '../errors/rbac.exception';
import { RBAC_PERMISSION_FETCHER } from '../constants';

describe('PermissionsAttachmentGuard', () => {
  const mockFetcher = jest.fn();
  let guard: PermissionsAttachmentGuard;

  const createMockContext = (request: { user?: { userId: string } }): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionsAttachmentGuard(mockFetcher);
  });

  it('throws 401 when user is missing', async () => {
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(RbacException);
    expect(mockFetcher).not.toHaveBeenCalled();
  });

  it('throws 401 when user.userId is missing', async () => {
    const ctx = createMockContext({ user: {} as { userId: string } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(RbacException);
  });

  it('calls permissionFetcher with userId and attaches permissions', async () => {
    const request = { user: { userId: 'u1' } };
    const ctx = createMockContext(request);
    mockFetcher.mockResolvedValue(['role:view']);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockFetcher).toHaveBeenCalledWith('u1');
    expect(request).toHaveProperty('permissions', ['role:view']);
  });

  it('throws 500 when permissionFetcher throws', async () => {
    const ctx = createMockContext({ user: { userId: 'u1' } });
    mockFetcher.mockRejectedValue(new Error('DB error'));
    await expect(guard.canActivate(ctx)).rejects.toThrow(RbacException);
    try {
      await guard.canActivate(ctx);
    } catch (e) {
      expect((e as RbacException).getStatus()).toBe(500);
    }
  });
});
