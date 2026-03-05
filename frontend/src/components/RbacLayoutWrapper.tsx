'use client';

import { useAuth } from '@/hooks/useAuth';
import { PermissionProvider } from '@/rbac';

/**
 * Wraps children with PermissionProvider using the current user id from AuthContext.
 * Must be used inside AuthProvider.
 */
export default function RbacLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return (
    <PermissionProvider userId={user?.id ?? null}>
      {children}
    </PermissionProvider>
  );
}
