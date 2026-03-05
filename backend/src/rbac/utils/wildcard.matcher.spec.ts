import { matchesPermission } from './wildcard.matcher';

describe('matchesPermission', () => {
  describe('global wildcard *:*', () => {
    it('returns true for any required permission', () => {
      expect(matchesPermission(['*:*'], 'role:create')).toBe(true);
      expect(matchesPermission(['*:*'], 'admin:delete')).toBe(true);
      expect(matchesPermission(['*:*'], 'own:task-view')).toBe(true);
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

  describe('module wildcard module:*', () => {
    it('returns true when module:* is in list', () => {
      expect(matchesPermission(['role:*'], 'role:create')).toBe(true);
      expect(matchesPermission(['role:*'], 'role:delete')).toBe(true);
      expect(matchesPermission(['task:*'], 'task:update-status')).toBe(true);
      expect(matchesPermission(['own:*'], 'own:task-view')).toBe(true);
    });

    it('returns false for different module', () => {
      expect(matchesPermission(['role:*'], 'user:create')).toBe(false);
      expect(matchesPermission(['task:*'], 'role:view')).toBe(false);
    });
  });

  describe('no match', () => {
    it('returns false when no permission matches', () => {
      expect(matchesPermission(['user:create'], 'user:delete')).toBe(false);
      expect(matchesPermission(['admin:create'], 'admin:view')).toBe(false);
      expect(matchesPermission(['task:view'], 'task:create')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles null/undefined userPermissions', () => {
      expect(matchesPermission(null as unknown as string[], 'role:create')).toBe(false);
      expect(matchesPermission(undefined as unknown as string[], 'role:create')).toBe(false);
    });

    it('handles empty required with wildcard', () => {
      expect(matchesPermission(['*:*'], '')).toBe(true);
    });
  });
});
