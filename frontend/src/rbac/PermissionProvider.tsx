'use client';

import React, { createContext, useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import { matchesPermission } from './utils/wildcardMatcher';

interface PermissionContextValue {
  permissions: string[];
  isLoading: boolean;
  error: Error | null;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

export const PermissionContext = createContext<PermissionContextValue | null>(null);

interface PermissionProviderProps {
  userId: string | null;
  children: React.ReactNode;
}

/**
 * Fetches and stores the user's aggregated permissions from the RBAC API.
 * Exposes hasPermission (wildcard matching) and refreshPermissions.
 */
export function PermissionProvider({ userId, children }: PermissionProviderProps) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!userId) {
      setPermissions([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ success: true; data: { userId: string; permissions: string[] } }>(
        `/api/rbac/users/${encodeURIComponent(userId)}/permissions`,
      );
      const payload = data?.data ?? data;
      const list = Array.isArray(payload?.permissions) ? payload.permissions : [];
      setPermissions(list);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setPermissions([]);
      if (typeof console !== 'undefined') {
        console.error('[PermissionProvider] Failed to fetch permissions', e);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permission: string) => matchesPermission(permissions, permission),
    [permissions],
  );

  const refreshPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  const value: PermissionContextValue = {
    permissions,
    isLoading,
    error,
    hasPermission,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}
