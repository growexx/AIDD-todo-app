'use client';

import { useState } from 'react';
import { usePermission } from '@/rbac';
import { getUserRoles, assignRoleToUser, removeRoleFromUser, listRoles, type Role } from '../utils/rbacApi';
import { PermissionGate } from '@/rbac';
import AccessDenied from '../components/AccessDenied';
import { getApiErrorMessage } from '@/lib/getApiError';
import toast from 'react-hot-toast';

export default function UserRolesPage() {
  const [userId, setUserId] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = userId.trim();
    if (!id) {
      toast.error('Enter a user ID');
      return;
    }
    setLoading(true);
    try {
      const r = await getUserRoles(id);
      setRoles(r);
      if (allRoles.length === 0) {
        const res = await listRoles({ limit: 100 });
        setAllRoles(res.data);
      }
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'User not found or no access');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    const id = userId.trim();
    if (!id || !assignRoleId) return;
    try {
      await assignRoleToUser(id, { roleId: assignRoleId });
      toast.success('Role assigned');
      setAssignRoleId('');
      const r = await getUserRoles(id);
      setRoles(r);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to assign role');
    }
  };

  const handleRevoke = async (roleId: string) => {
    const id = userId.trim();
    if (!id) return;
    try {
      await removeRoleFromUser(id, roleId);
      toast.success('Role revoked');
      const r = await getUserRoles(id);
      setRoles(r);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Failed to revoke role');
    }
  };

  return (
    <PermissionGate permission="role:view" fallback={<AccessDenied />}>
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">User roles</h1>
        <p className="mt-1 text-sm text-zinc-500">Look up a user by ID and manage their role assignments.</p>
        <form onSubmit={handleLookup} className="mt-4 flex gap-2">
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID (e.g. MongoDB _id)"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Look up'}
          </button>
        </form>
        {roles.length >= 0 && userId.trim() && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <h2 className="font-medium text-zinc-800">Assigned roles</h2>
              <ul className="mt-2 space-y-1">
                {roles.map((r) => (
                  <li key={r._id} className="flex items-center justify-between text-sm">
                    <span>{r.name}</span>
                    <PermissionGate permission="role:revoke">
                      <button
                        type="button"
                        onClick={() => handleRevoke(r._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Revoke
                      </button>
                    </PermissionGate>
                  </li>
                ))}
                {roles.length === 0 && <li className="text-zinc-500">No roles assigned</li>}
              </ul>
            </div>
            <PermissionGate permission="role:assign">
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <h2 className="font-medium text-zinc-800">Assign role</h2>
                <div className="mt-2 flex gap-2">
                  <select
                    value={assignRoleId}
                    onChange={(e) => setAssignRoleId(e.target.value)}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select role</option>
                    {allRoles.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={!assignRoleId}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </PermissionGate>
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
