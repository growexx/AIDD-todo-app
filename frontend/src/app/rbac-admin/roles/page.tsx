'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePermission, PermissionGate } from '@/rbac';
import { listRoles, deleteRole, updateRole, type Role } from '../utils/rbacApi';
import AccessDenied from '../components/AccessDenied';
import CreateRoleModal from './CreateRoleModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { getApiErrorMessage } from '@/lib/getApiError';
import toast from 'react-hot-toast';

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRoles({ page: meta.page, limit: meta.limit, search: search || undefined });
      const list = Array.isArray(res?.data) ? res.data : [];
      const listMeta = res?.meta ?? { page: 1, limit: 20, total: 0 };
      setRoles(list);
      setMeta((m) => ({ ...m, ...listMeta }));
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to load roles');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [meta.page, meta.limit, search]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleSetDefault = async (role: Role) => {
    try {
      await updateRole(role._id, { isDefault: true });
      toast.success(`Default role set to ${role.name}`);
      fetchRoles();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to set default role');
    }
  };

  const handleDelete = async (role: Role) => {
    try {
      await deleteRole(role._id);
      toast.success('Role deleted');
      setDeleteTarget(null);
      fetchRoles();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to delete role');
    }
  };

  return (
    <PermissionGate permission="role:view" fallback={<AccessDenied />}>
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">Roles</h1>
        <div className="mt-4 flex items-center gap-4">
          <input
            type="search"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <PermissionGate permission="role:create">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Create role
            </button>
          </PermissionGate>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading…</div>
          ) : (
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Default</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Permissions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {(roles ?? []).map((role) => (
                  <tr key={role._id}>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{role.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{role.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      {role.isDefault ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Default
                        </span>
                      ) : (
                        <PermissionGate permission="role:update">
                          <button
                            type="button"
                            onClick={() => handleSetDefault(role)}
                            className="text-sm text-zinc-500 hover:text-zinc-700"
                          >
                            Set as default
                          </button>
                        </PermissionGate>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {Array.isArray(role.permissions) ? role.permissions.length : 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/rbac-admin/roles/${role._id}`}
                        className="mr-3 text-sm text-zinc-600 hover:text-zinc-900"
                      >
                        Edit
                      </Link>
                      {!role.isDefault && (
                        <PermissionGate permission="role:delete">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(role)}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </PermissionGate>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-zinc-500">
          <span>
            Page {meta.page}, total {meta.total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => setMeta((m) => ({ ...m, page: m.page - 1 }))}
              className="rounded px-2 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={meta.page * meta.limit >= meta.total}
              onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
              className="rounded px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <CreateRoleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          fetchRoles();
        }}
      />
      <ConfirmDeleteModal
        role={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTarget ? () => handleDelete(deleteTarget) : undefined}
      />
    </PermissionGate>
  );
}
