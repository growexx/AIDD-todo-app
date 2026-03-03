'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { LoginFormData } from '@/types';

const ACCOUNT_LOCKED_MESSAGE =
  'Account locked. Check your email for reset instructions.';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';

type LoginStep = 'credentials' | 'mfa';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [form, setForm] = useState<LoginFormData>({ email: '', password: '' });
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setResetSuccess(true);
    }
  }, [searchParams]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{
        success: true;
        data:
          | { access_token: string; user: { id: string; name: string; email: string } }
          | { requiresMfa: true; mfaPendingToken: string };
      }>('/api/auth/login', form);

      const payload = data.data;
      if ('requiresMfa' in payload && payload.requiresMfa) {
        setMfaPendingToken(payload.mfaPendingToken);
        setStep('mfa');
        setMfaCode('');
      } else if ('access_token' in payload) {
        login(payload.access_token, payload.user);
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const res = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string } } }).response
        : null;
      const message = res?.data?.message ?? 'Login failed';
      if (res?.status === 403) {
        setError(ACCOUNT_LOCKED_MESSAGE);
      } else {
        setError(message === 'Forbidden' ? ACCOUNT_LOCKED_MESSAGE : message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaPendingToken) return;
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{
        success: true;
        data: { access_token: string; user: { id: string; name: string; email: string } };
      }>('/api/auth/verify-mfa', {
        mfaPendingToken,
        code: mfaCode,
      });
      const payload = data.data;
      login(payload.access_token, payload.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Invalid verification code';
      setError(message ?? 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const backToCredentials = () => {
    setStep('credentials');
    setMfaPendingToken(null);
    setMfaCode('');
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-800">Todo App</h1>

        {resetSuccess && (
          <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            Password and MFA reset. You can log in now.
          </p>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <p className="text-sm text-zinc-600">
              Enter the 6-digit code from your authenticator app (or a backup code).
            </p>
            <div>
              <label htmlFor="mfa-code" className="mb-1 block text-sm font-medium text-zinc-700">
                Verification code
              </label>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="123456"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-lg tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                maxLength={10}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={backToCredentials}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
          <p className="mb-2 font-medium text-zinc-700">Demo credentials:</p>
          <p>alice@todoapp.com / Alice@123</p>
          <p>bob@todoapp.com   / Bob@123</p>
          <p>carol@todoapp.com / Carol@123</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
          <h1 className="mb-6 text-2xl font-semibold text-zinc-800">Todo App</h1>
          <p className="text-zinc-500">Loading…</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
