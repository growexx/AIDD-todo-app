'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermission } from '@/rbac';

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermission('role:view');

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <span className="text-xl font-semibold text-zinc-800">Todo App</span>
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-800"
        >
          Settings
        </Link>
        {hasPermission && (
          <Link
            href="/rbac-admin"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-800"
          >
            RBAC Admin
          </Link>
        )}
        <span className="text-sm text-zinc-600">{user?.name ?? user?.email}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-300"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
