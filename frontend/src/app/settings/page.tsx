'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/getApiError';
import Navbar from '@/components/Navbar';

type MfaSetupState = 'idle' | 'loading' | 'qr';

interface MfaSetupResponse {
  qrUri: string;
  qrDataUrl: string;
  backupCodes: string[];
  secret: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaStatusLoading, setMfaStatusLoading] = useState(true);
  const [mfaSetupState, setMfaSetupState] = useState<MfaSetupState>('idle');
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaConfirming, setMfaConfirming] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) {
      if (hydrated && !isAuthenticated) {
        router.push('/login');
      }
      return;
    }
    const fetchStatus = async () => {
      try {
        const { data } = await api.get<{ success: true; data: { mfaEnabled: boolean } }>(
          '/api/auth/mfa/status',
        );
        setMfaEnabled(data.data.mfaEnabled);
      } catch {
        router.push('/login');
      } finally {
        setMfaStatusLoading(false);
      }
    };
    fetchStatus();
  }, [hydrated, isAuthenticated, router]);

  const startMfaSetup = async () => {
    setMfaSetupState('loading');
    try {
      const { data } = await api.post<{ success: true; data: MfaSetupResponse }>(
        '/api/auth/mfa/setup',
      );
      setMfaSetupData(data.data);
      setMfaSetupState('qr');
      setMfaCode('');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
      setMfaSetupState('idle');
    }
  };

  const confirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    setMfaConfirming(true);
    try {
      await api.post('/api/auth/mfa/confirm', { code: mfaCode.trim() });
      setMfaEnabled(true);
      setMfaSetupData(null);
      setMfaSetupState('idle');
      setMfaCode('');
      toast.success('Two-factor authentication enabled.');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setMfaConfirming(false);
    }
  };

  const cancelMfaSetup = () => {
    setMfaSetupData(null);
    setMfaSetupState('idle');
    setMfaCode('');
  };

  if (!hydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-800">Settings</h1>

        {mfaStatusLoading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-zinc-800">Two-factor authentication (2FA)</h2>
            {mfaEnabled ? (
              <p className="text-sm text-zinc-600">MFA is enabled. Use your authenticator app when signing in.</p>
            ) : mfaSetupState === 'idle' ? (
              <div>
                <p className="mb-4 text-sm text-zinc-600">
                  Add an extra layer of security by enabling 2FA. You will scan a QR code with an app like Google Authenticator.
                </p>
                <button
                  type="button"
                  onClick={startMfaSetup}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                >
                  Enable 2FA
                </button>
              </div>
            ) : mfaSetupState === 'loading' ? (
              <p className="text-sm text-zinc-500">Preparing QR code…</p>
            ) : mfaSetupState === 'qr' && mfaSetupData ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600">
                  Scan this QR code with your authenticator app, then enter the 6-digit code below.
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mfaSetupData.qrDataUrl}
                    alt="MFA QR code"
                    width={200}
                    height={200}
                    className="rounded-lg border border-zinc-200"
                  />
                </div>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <p className="mb-2 text-xs font-medium text-zinc-500">Backup codes (save these; each can be used once):</p>
                  <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                    {mfaSetupData.backupCodes.map((code, i) => (
                      <span key={i} className="truncate">{code}</span>
                    ))}
                  </div>
                </div>
                <form onSubmit={confirmMfa} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1">
                    <label htmlFor="mfa-confirm-code" className="mb-1 block text-xs font-medium text-zinc-600">
                      Verification code
                    </label>
                    <input
                      id="mfa-confirm-code"
                      type="text"
                      inputMode="numeric"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="123456"
                      className="w-full rounded border border-zinc-300 px-3 py-2 font-mono"
                      maxLength={10}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={mfaConfirming}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {mfaConfirming ? 'Verifying…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelMfaSetup}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        )}

        <p className="mt-6 text-sm text-zinc-500">
          If you are locked out, use the link sent to your email to reset your password and MFA.
        </p>
      </main>
    </div>
  );
}
