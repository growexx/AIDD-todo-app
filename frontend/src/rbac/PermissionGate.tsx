'use client';

import React, { useContext } from 'react';
import { PermissionContext } from './PermissionProvider';

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

/**
 * Renders children if the user has the required permission (wildcard matching).
 * Shows loadingFallback while loading, fallback when access is denied.
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
  loadingFallback = null,
}: PermissionGateProps) {
  const context = useContext(PermissionContext);

  if (context === null) {
    return <>{fallback}</>;
  }

  const { isLoading, hasPermission } = context;

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
