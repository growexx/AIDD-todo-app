import {
  PERMISSIONS,
  getAllPermissionCodes,
  getAllPermissionCodesWithWildcards,
  isValidPermissionCode,
} from './rbac.registry';

describe('rbac.registry', () => {
  describe('PERMISSIONS', () => {
    it('contains all expected keys and values', () => {
      expect(PERMISSIONS.ROLE_CREATE).toBe('role:create');
      expect(PERMISSIONS.ROLE_VIEW).toBe('role:view');
      expect(PERMISSIONS.ADMIN_CREATE).toBe('admin:create');
      expect(PERMISSIONS.GLOBAL_WILDCARD).toBe('*:*');
      expect(PERMISSIONS.USER_VIEW_PERMISSIONS).toBe('user:view-permissions');
    });

    it('has no duplicate values', () => {
      const values = Object.values(PERMISSIONS);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('getAllPermissionCodes', () => {
    it('returns an array', () => {
      expect(Array.isArray(getAllPermissionCodes())).toBe(true);
    });

    it('does not include *:*', () => {
      const codes = getAllPermissionCodes();
      expect(codes).not.toContain('*:*');
    });

    it('includes role:create, user:create, task:update-status, own:task-view', () => {
      const codes = getAllPermissionCodes();
      expect(codes).toContain('role:create');
      expect(codes).toContain('user:create');
      expect(codes).toContain('task:update-status');
      expect(codes).toContain('own:task-view');
    });

    it('has no duplicates', () => {
      const codes = getAllPermissionCodes();
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  describe('getAllPermissionCodesWithWildcards', () => {
    it('includes *:*', () => {
      expect(getAllPermissionCodesWithWildcards()).toContain('*:*');
    });

    it('includes all standard codes as subset', () => {
      const standard = getAllPermissionCodes();
      const withWildcards = getAllPermissionCodesWithWildcards();
      for (const code of standard) {
        expect(withWildcards).toContain(code);
      }
    });

    it('has no duplicates', () => {
      const codes = getAllPermissionCodesWithWildcards();
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  describe('isValidPermissionCode', () => {
    it('returns true for valid codes', () => {
      expect(isValidPermissionCode('role:create')).toBe(true);
      expect(isValidPermissionCode('task:update-status')).toBe(true);
      expect(isValidPermissionCode('own:task-view')).toBe(true);
      expect(isValidPermissionCode('*:*')).toBe(true);
      expect(isValidPermissionCode('role:*')).toBe(true);
      expect(isValidPermissionCode('a:b')).toBe(true);
      expect(isValidPermissionCode('abc-def:ghi_jkl')).toBe(true);
    });

    it('returns false for invalid codes', () => {
      expect(isValidPermissionCode('')).toBe(false);
      expect(isValidPermissionCode('invalid')).toBe(false);
      expect(isValidPermissionCode('ROLE:create')).toBe(false);
      expect(isValidPermissionCode('role:')).toBe(false);
      expect(isValidPermissionCode('role:create:extra')).toBe(false);
      expect(isValidPermissionCode(':create')).toBe(false);
    });

    it('returns false for non-string', () => {
      expect(isValidPermissionCode(null as unknown as string)).toBe(false);
      expect(isValidPermissionCode(undefined as unknown as string)).toBe(false);
      expect(isValidPermissionCode(123 as unknown as string)).toBe(false);
    });
  });
});
