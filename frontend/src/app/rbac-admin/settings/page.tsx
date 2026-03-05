'use client';

import { useState } from 'react';
import { usePermission } from '@/rbac';
import { backfillDefaultRole } from '../utils/rbacApi';
import { PermissionGate } from '@/rbac';
import AccessDenied from '../components/AccessDenied';
import { getApiErrorMessage } from '@/lib/getApiError';
import toast from 'react-hot-toast';

export default function RbacSettingsPage() {
  const [batchSize, setBatchSize] = useState(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ processed: number; backfilled: number; skipped: number } | null>(null);

  const handleBackfill = async () => {
    setRunning(true);
    setResult(null);
    try {
      const data = await backfillDefaultRole({ batchSize });
      setResult(data);
      toast.success('Back-fill completed');
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Back-fill failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <PermissionGate permission="role:assign" fallback={<AccessDenied />}>
      <div>
        <h1 className="text-xl font-semibold text-zinc-800">RBAC settings</h1>
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="font-medium text-zinc-800">Default role back-fill</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Assign the current default role (isDefault: true) to all users who do not have any role. Idempotent — safe
            to run multiple times.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span>Batch size:</span>
              <input
                type="number"
                min={1}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value) || 100)}
                className="w-24 rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <button
              type="button"
              onClick={handleBackfill}
              disabled={running}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {running ? 'Running…' : 'Run back-fill'}
            </button>
          </div>
          {result && (
            <div className="mt-4 rounded bg-zinc-100 p-3 text-sm text-zinc-700">
              Processed: {result.processed}, newly assigned: {result.backfilled}, already had role: {result.skipped}
            </div>
          )}
        </div>
      </div>
    </PermissionGate>
  );
}
