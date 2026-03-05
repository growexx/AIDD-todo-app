'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermission } from '@/rbac';
import {
  getRole,
  updateRole,
  getUsersByRole,
  addPermissionToRole,
  removePermissionFromRole,
  listPermissions,
  type Role,
  type Permission,
} from '../../utils/rbacApi';
import { PermissionGate } from '@/rbac';
import AccessDenied from '../../components/AccessDenied';
import { getApiErrorMessage } from '@/lib/getApiError';
import toast from 'react-hot-toast';

export default function RoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [role, setRole] = useState<Role | null>(null);
  const [users, setUsers] = useState<{ userId: string }[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editing, setEditing] = useState(false);
  const [addPermCode, setAddPermCode] = useState('');

  const fetchRole = useCallback(async () => {
    if (!id) return;
    try {
      const r = await getRole(id);
      setRole(r);
      setEditName(r.name);
      setEditDesc(r.description ?? '');
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Role not found');
      router.push('/rbac-admin/roles');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchUsers = useCallback(async () => {
    if (!id) return;
    try {
      const u = await getUsersByRole(id);
      setUsers(u);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to load users');
      setUsers([]);
    }
  }, [id]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    listPermissions({ limit: 200 })
      .then((res) => setAllPermissions(res.data))
      .catch((e: unknown) => {
        toast.error(getApiErrorMessage(e) || 'Failed to load permissions');
        setAllPermissions([]);
      });
  }, []);

  const handleSave = async () => {
    if (!role) return;
    try {
      await updateRole(role._id, { name: editName.trim(), description: editDesc.trim() });
      toast.success('Role updated');
      setEditing(false);
      fetchRole();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to update');
    }
  };

  const handleAddPermission = async () => {
    if (!role || !addPermCode.trim()) return;
    try {
      await addPermissionToRole(role._id, addPermCode.trim());
      toast.success('Permission added');
      setAddPermCode('');
      fetchRole();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to add permission');
    }
  };

  const handleRemovePermission = async (permId: string) => {
    if (!role) return;
    try {
      await removePermissionFromRole(role._id, permId);
      toast.success('Permission removed');
      fetchRole();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to remove permission');
    }
  };

  const rolePermIds = new Set((role?.permissions ?? []).map((p) => (typeof p === 'object' ? p._id : p)));

  return (
    <PermissionGate permission="role:view" fallback={<AccessDenied />}>
      <div>
        <Link href="/rbac-admin/roles" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Roles
        </Link>
        {loading ? (
          <p className="mt-4 text-zinc-500">Loading…</p>
        ) : role ? (
          <div className="mt-4 space-y-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h1 className="text-lg font-semibold text-zinc-800">Role: {role.name}</h1>
              {editing ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded px-3 py-1.5 text-sm text-zinc-600">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-zinc-600">{role.description || '—'}</p>
                  <PermissionGate permission="role:update">
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="mt-2 text-sm text-zinc-500 hover:text-zinc-700"
                    >
                      Edit
                    </button>
                  </PermissionGate>
                </>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="font-medium text-zinc-800">Permissions</h2>
              <PermissionGate permission="permission:manage">
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={addPermCode}
                    onChange={(e) => setAddPermCode(e.target.value)}
                    placeholder="e.g. role:create"
                    className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddPermission}
                    className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
                  >
                    Add
                  </button>
                </div>
              </PermissionGate>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(role.permissions ?? []).map((p) => (
                  <li
                    key={typeof p === 'object' ? p._id : p}
                    className="flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-sm"
                  >
                    <span>{typeof p === 'object' ? p.code : p}</span>
                    <PermissionGate permission="permission:manage">
                      <button
                        type="button"
                        onClick={() => handleRemovePermission(typeof p === 'object' ? p._id : p)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </PermissionGate>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="font-medium text-zinc-800">Users with this role ({users.length})</h2>
              <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-zinc-600">
                {users.map((u) => (
                  <li key={u.userId}>{u.userId}</li>
                ))}
                {users.length === 0 && <li>None</li>}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </PermissionGate>
  );
}
