'use client';

import type { User } from '@/types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/**
 * Returns the stored JWT token or null.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Stores token and user in localStorage.
 */
export function setAuth(token: string, user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clears token and user from localStorage.
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Returns the parsed user object or null.
 */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/**
 * Returns true if a token exists.
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}
