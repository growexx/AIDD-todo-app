'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PermissionGate, usePermission } from '@/rbac';
import AccessDenied from './components/AccessDenied';

const nav = [
  { href: '/rbac-admin/roles', label: 'Roles', permission: 'role:view' as const },
  { href: '/rbac-admin/permissions', label: 'Permissions', permission: 'permission:view' as const },
  { href: '/rbac-admin/users', label: 'User roles', permission: 'role:view' as const },
  { href: '/rbac-admin/settings', label: 'Settings', permission: 'role:assign' as const },
];

function NavLink({ href, label, permission }: { href: string; label: string; permission: string }) {
  const pathname = usePathname();
  const { hasPermission } = usePermission(permission);
  if (!hasPermission) return null;
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm font-medium ${
        active ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      {label}
    </Link>
  );
}

export default function RbacAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hasPermission } = usePermission('role:view');
  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <h1 className="text-xl font-semibold text-zinc-800">RBAC Admin</h1>
        <div className="mt-4">
          <AccessDenied />
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex">
        <aside className="w-56 border-r border-zinc-200 bg-white p-4">
          <Link href="/rbac-admin" className="mb-4 block text-lg font-semibold text-zinc-800">
            RBAC Admin
          </Link>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} permission={item.permission} />
            ))}
          </nav>
          <Link
            href="/dashboard"
            className="mt-4 block text-sm text-zinc-500 hover:text-zinc-700"
          >
            ← Back to app
          </Link>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
