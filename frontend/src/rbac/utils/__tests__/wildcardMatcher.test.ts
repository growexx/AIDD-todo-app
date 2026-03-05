import { matchesPermission } from '../wildcardMatcher';

describe('matchesPermission', () => {
  describe('global wildcard *:*', () => {
    it('returns true for any required permission', () => {
      expect(matchesPermission(['*:*'], 'role:create')).toBe(true);
      expect(matchesPermission(['*:*'], 'admin:delete')).toBe(true);
    });
  });

  describe('exact match', () => {
    it('returns true when permission is in list', () => {
      expect(matchesPermission(['role:create'], 'role:create')).toBe(true);
      expect(matchesPermission(['task:view', 'task:update-status'], 'task:update-status')).toBe(true);
    });
    it('returns false when permission is not in list', () => {
      expect(matchesPermission(['role:create'], 'role:view')).toBe(false);
      expect(matchesPermission([], 'role:create')).toBe(false);
    });
  });

  describe('module wildcard', () => {
    it('returns true when module:* is in list', () => {
      expect(matchesPermission(['role:*'], 'role:create')).toBe(true);
      expect(matchesPermission(['task:*'], 'task:update-status')).toBe(true);
    });
    it('returns false for different module', () => {
      expect(matchesPermission(['role:*'], 'user:create')).toBe(false);
    });
  });

  describe('invalid userPermissions', () => {
    it('returns false when userPermissions is null or undefined', () => {
      expect(matchesPermission(null as unknown as string[], 'role:create')).toBe(false);
      expect(matchesPermission(undefined as unknown as string[], 'role:view')).toBe(false);
    });
  });
});
