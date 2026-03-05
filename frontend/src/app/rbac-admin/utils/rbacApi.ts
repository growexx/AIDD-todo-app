/**
 * RBAC API client. Uses app api instance (auth headers).
 * Response envelope: { success: true, data: T } from backend.
 */

import api from '@/lib/api';

const RBAC = '/api/rbac';

function unwrap<T>(res: { data?: { data?: T }; data?: T }): T {
  const d = res?.data;
  if (d && typeof d === 'object' && 'data' in d && d.data !== undefined) {
    return d.data as T;
  }
  return d as T;
}

/** Extract list + meta from list endpoints; handles { data, meta } or raw array. */
function parseListResponse<T>(
  res: { data?: T[]; meta?: ListMeta } | T[] | undefined,
): { data: T[]; meta: ListMeta } {
  if (Array.isArray(res)) {
    return { data: res, meta: { page: 1, limit: res.length, total: res.length } };
  }
  const list = Array.isArray(res?.data) ? res.data : [];
  const meta = res?.meta ?? { page: 1, limit: 20, total: 0 };
  return { data: list, meta };
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  /** List endpoint returns IDs only; detail endpoint may return populated { _id, code } */
  permissions?: Array<{ _id: string; code?: string } | string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  _id: string;
  code: string;
  description?: string;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
}

// Roles
export async function listRoles(params: { page?: number; limit?: number; search?: string }) {
  const res = await api.get<{ success?: boolean; data: { data: Role[]; meta: ListMeta } | Role[] }>(`${RBAC}/roles`, {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, search: params.search ?? '' },
  });
  const body = res?.data;
  const inner = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body;
  return parseListResponse(
    typeof inner === 'object' && inner !== null && 'meta' in (inner as object)
      ? (inner as { data: Role[]; meta: ListMeta })
      : Array.isArray(inner)
        ? inner
        : undefined,
  );
}

export async function getRole(id: string) {
  const { data } = await api.get<{ data: Role }>(`${RBAC}/roles/${id}`);
  return unwrap<Role>(data);
}

export async function createRole(body: { name: string; description?: string }) {
  const { data } = await api.post<{ data: Role }>(`${RBAC}/roles`, body);
  return unwrap<Role>(data);
}

export async function updateRole(id: string, body: { name?: string; description?: string; isDefault?: boolean }) {
  const { data } = await api.patch<{ data: Role }>(`${RBAC}/roles/${id}`, body);
  return unwrap<Role>(data);
}

export async function deleteRole(id: string) {
  await api.delete(`${RBAC}/roles/${id}`);
}

export async function getUsersByRole(roleId: string) {
  const { data } = await api.get<{ data: { data: { userId: string }[] } }>(`${RBAC}/roles/${roleId}/users`);
  const payload = unwrap<{ data: { userId: string }[] }>(data);
  return Array.isArray(payload?.data) ? payload.data : [];
}

// Permissions
export async function addPermissionToRole(roleId: string, permissionCode: string) {
  const { data } = await api.post<{ data: Role }>(`${RBAC}/roles/${roleId}/permissions`, {
    permissionCode,
  });
  return unwrap<Role>(data);
}

export async function removePermissionFromRole(roleId: string, permissionId: string) {
  await api.delete(`${RBAC}/roles/${roleId}/permissions/${permissionId}`);
}

export async function listPermissions(params: { page?: number; limit?: number; search?: string }) {
  const res = await api.get<{ success?: boolean; data: { data: Permission[]; meta: ListMeta } | Permission[] }>(
    `${RBAC}/permissions`,
    { params: { page: params.page ?? 1, limit: params.limit ?? 20, search: params.search ?? '' } },
  );
  const body = res?.data;
  const inner = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body;
  return parseListResponse(
    typeof inner === 'object' && inner !== null && 'meta' in (inner as object)
      ? (inner as { data: Permission[]; meta: ListMeta })
      : Array.isArray(inner)
        ? inner
        : undefined,
  );
}

// User roles
export async function getUserRoles(userId: string) {
  const { data } = await api.get<{ data: { data: Role[] } }>(`${RBAC}/users/${userId}/roles`);
  const payload = unwrap<{ data: Role[] }>(data);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function assignRoleToUser(userId: string, body: { roleId?: string; roleName?: string }) {
  await api.post(`${RBAC}/users/${userId}/roles`, body);
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  await api.delete(`${RBAC}/users/${userId}/roles/${roleId}`);
}

// Backfill
export async function backfillDefaultRole(body?: { batchSize?: number }) {
  const { data } = await api.post<{ data: { processed: number; backfilled: number; skipped: number } }>(
    `${RBAC}/admin/backfill-default-role`,
    body ?? {},
  );
  return unwrap<{ processed: number; backfilled: number; skipped: number }>(data);
}
