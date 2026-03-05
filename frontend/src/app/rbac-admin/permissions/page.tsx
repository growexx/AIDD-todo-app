'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePermission } from '@/rbac';
import { listPermissions, type Permission } from '../utils/rbacApi';
import { PermissionGate } from '@/rbac';
import AccessDenied from '../components/AccessDenied';
import { getApiErrorMessage } from '@/lib/getApiError';
import toast from 'react-hot-toast';

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPermissions({ page: meta.page, limit: meta.limit, search: search || undefined });
      const list = Array.isArray(res?.data) ? res.data : [];
      const listMeta = res?.meta ?? { page: 1, limit: 50, total: 0 };
      setPermissions(list);
      setMeta((m) => ({ ...m, ...listMeta }));
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to load permissions');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [meta.page, meta.limit, search]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return (
    <PermissionGate permission="permission:view" fallback={<AccessDenied />}>
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Permissions</h1>
        <p className="mt-1 text-sm text-zinc-500">Read-only list of permission codes in the system.</p>
        <div className="mt-4">
          <input
            type="search"
            placeholder="Search by code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading…</div>
          ) : (
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {(permissions ?? []).map((p) => (
                  <tr key={p._id}>
                    <td className="px-4 py-3 font-mono text-sm text-zinc-900">{p.code}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{p.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-2 text-sm text-zinc-500">
          Page {meta.page}, total {meta.total}
        </div>
      </div>
    </PermissionGate>
  );
}
