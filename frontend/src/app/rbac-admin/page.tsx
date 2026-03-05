'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/rbac';

export default function RbacAdminPage() {
  const router = useRouter();
  const { hasPermission, isLoading } = usePermission('role:view');
  useEffect(() => {
    if (isLoading) return;
    if (hasPermission) {
      router.replace('/rbac-admin/roles');
    }
  }, [hasPermission, isLoading, router]);
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-zinc-500">Loading…</p>
    </div>
  );
}
