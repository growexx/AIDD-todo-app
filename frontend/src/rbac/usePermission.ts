'use client';

import { useContext } from 'react';
import { PermissionContext } from './PermissionProvider';

/**
 * Returns hasPermission and isLoading for the given permission.
 * Throws if used outside PermissionProvider.
 */
export function usePermission(permission: string): { hasPermission: boolean; isLoading: boolean } {
  const context = useContext(PermissionContext);
  if (context === null) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  const { hasPermission, isLoading } = context;
  return {
    hasPermission: hasPermission(permission),
    isLoading,
  };
}
