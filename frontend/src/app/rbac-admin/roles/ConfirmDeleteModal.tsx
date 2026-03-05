'use client';

import type { Role } from '../utils/rbacApi';

export default function ConfirmDeleteModal({
  role,
  onClose,
  onConfirm,
}: {
  role: Role | null;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  if (!role) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-zinc-800">Delete role</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Are you sure you want to delete the role &quot;{role.name}&quot;? This will remove the role from all assigned
          users.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm?.();
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
